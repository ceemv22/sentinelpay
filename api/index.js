const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const helmet = require('helmet');
require('dotenv').config();

const { runScoringEngine } = require('./services/scorer');
const prisma = require('./services/db');
const requireApiKey = require('./middleware/auth');
const requireSupabaseAuth = require('./middleware/supabaseAuth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "https://aivqwkgjdpklxxuvkxpy.supabase.co", "https://cdn.jsdelivr.net"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "img-src": ["'self'", "data:", "https://aivqwkgjdpklxxuvkxpy.supabase.co"],
            "connect-src": ["'self'", "https://aivqwkgjdpklxxuvkxpy.supabase.co", "wss://aivqwkgjdpklxxuvkxpy.supabase.co", "https://api.etherscan.io"],
            "frame-ancestors": ["'none'"],
            "object-src": ["'none'"]
        }
    }
}));
app.use(cors({
    origin: (origin, callback) => {
        const allowed = process.env.ALLOWED_ORIGINS?.split(',').filter(o => o.length > 0) || [];
        if (allowed.includes('*')) {
            if (process.env.NODE_ENV === 'production') {
                return callback(new Error('Wildcard CORS disallowed in production.'));
            }
            return callback(null, true);
        }
        if (allowed.length === 0 || allowed.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['POST', 'GET'],
}));

// Stripe integration MUST be above express.json() because webhooks require raw Body Buffers for cryptographic signature verification.
app.use('/v1/stripe', require('./routes/stripe'));

app.use(express.json({ limit: '10kb' }));

// Ensure correct MIME types and No-Cache for HTML/JS during rapid debug phase
app.use((req, res, next) => {
    const p = req.path;
    if (p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.css') || p === '/auth' || p === '/') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
    if (p.endsWith('.js')) {
        res.type('application/javascript');
    } else if (p.endsWith('.css')) {
        res.type('text/css');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Redis Setup & Rate Limiter Store
const redisUrl = process.env.REDIS_URL;
let redisClient;

if (redisUrl) {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.error('[redis error]', err.message));
    redisClient.connect().catch(err => console.error('[redis connect error]', err.message));
    console.log('[rate-limit] Redis Client connected.');
} else {
    // Fallback to memory store if Redis is not configured (e.g. local testing)
    console.warn('[rate-limit] WARNING: REDIS_URL not found. Falling back to MemoryStore.');
}

function createStore(prefix) {
    if (!redisClient) return undefined;
    return new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: prefix
    });
}

// PLG Unauth Limiter logic: DUAL LAYER (IP-Daily + Fingerprint-Lifetime)
async function consumeUnauthCredit(req, res, next) {
    let rawFp = req.headers['x-fingerprint'];
    // Sanitize fingerprint perfectly
    const fingerprint = (typeof rawFp === 'string') && rawFp.trim().length > 0 ? rawFp.substring(0, 64) : null;
    const ip = req.ip || req.connection.remoteAddress;

    if (redisClient) {
        try {
            // LAYER 1: IP Rate Limiting (Prevent bot nets from refreshing fingerprints infinitely)
            // 20 scans per IP per day maximum for unauthenticated users
            const ipKey = `ip_limit:${ip}`;
            const ipUsage = await redisClient.incr(ipKey);
            if (ipUsage === 1) await redisClient.expire(ipKey, 86400); // 24 hours TTL
            
            if (ipUsage > 20) {
                return res.status(429).json({ error: 'network proxy usage too high. login required.', code: 429, requiresAuth: true });
            }

            // LAYER 2: Fingerprint Lifetime Limiter (3 free scans per device)
            if (fingerprint) {
                const fpKey = `unauth:fp:${fingerprint}`;
                const fpUsage = await redisClient.incr(fpKey);
                if (fpUsage > 3) {
                    await redisClient.decr(fpKey); // Keep accurate
                    return res.status(403).json({ error: 'free limit reached. please register.', code: 403, requiresAuth: true });
                }
            } else {
                // If they block headers/fingerprints, we bind them aggressively to IP (3 lifetime per IP)
                const strictIpKey = `strict:ip:${ip}`;
                const strictIpUsage = await redisClient.incr(strictIpKey);
                if (strictIpUsage > 3) {
                    await redisClient.decr(strictIpKey);
                    return res.status(403).json({ error: 'ip limit reached. please register.', code: 403, requiresAuth: true });
                }
            }
            next();
        } catch (err) {
            console.error('[redis auth error]', err);
            next(); // fail open securely
        }
    } else {
        next(); // local fallback
    }
}

// B2B API Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('b2b:'),
    message: { error: 'request limit exceeded. try again in 15 minutes.', code: 429 }
});

// Helper for audit logging
async function logAudit(req, wallet, result, apiKeyId = null) {
    const ip = req.ip; // trust proxy is enabled, so req.ip is the verified client IP
    try {
        await prisma.auditLog.create({
            data: {
                ip,
                wallet: wallet.toLowerCase(),
                score: result.score,
                category: result.category,
                flags: result.flags,
                endpoint: req.path,
                apiKeyId
            }
        });
        
        if (apiKeyId) {
            await prisma.apiKey.update({
                where: { id: apiKeyId },
                data: { requestsCount: { increment: 1 } }
            });
        }
    } catch (err) {
        console.error('[audit log error]', err);
    }
}

// B2B Protected Endpoint
app.post('/v1/score', limiter, requireApiKey, async (req, res) => {
    const { wallet } = req.body;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'invalid wallet address format', code: 400 });
    }

    try {
        const result = await runScoringEngine(wallet);
        await logAudit(req, wallet, result, req.apiKey.id);
        
        res.json({
            wallet: wallet.toLowerCase(),
            score: result.score,
            category: result.category,
            flags: result.flags,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[b2b score error]', err);
        res.status(err.status || 500).json({ error: 'failed to process risk score', code: 500 });
    }
});

// PLG Public Endpoint (Unauth)
app.post('/v1/public/score', consumeUnauthCredit, async (req, res) => {
    const { wallet } = req.body;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'invalid wallet address format', code: 400 });
    }

    try {
        const result = await runScoringEngine(wallet);
        await logAudit(req, wallet, result, null);

        res.json({
            wallet: wallet.toLowerCase(),
            score: result.score,
            category: result.category,
            flags: result.flags,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[public score error]', err);
        res.status(err.status || 500).json({ error: 'failed to process risk score', code: 500 });
    }
});

// PLG Auth Endpoint (Logged In Users with Credits)
app.post('/v1/user/score', requireSupabaseAuth, async (req, res) => {
    const { wallet } = req.body;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'invalid wallet address format', code: 400 });
    }

    if (req.user.credits <= 0) {
        return res.status(403).json({ error: 'insufficient credits. please upgrade your plan.', code: 403, requiresUpgrade: true });
    }

    try {
        const result = await runScoringEngine(wallet);
        
        // OWASP S-Tier Fix: Atomic update prevents Race Conditions for negative credits
        const updatedUser = await prisma.user.updateMany({
            where: {
                id: req.user.id,
                credits: { gt: 0 } // Only decrement if they ACTUALLY have > 0 credits
            },
            data: { credits: { decrement: 1 } }
        });

        if (updatedUser.count === 0) {
            return res.status(403).json({ error: 'zero credits internally. bypass thwarted.', code: 403, requiresUpgrade: true });
        }

        // Only after an atomic decrement do we log the scan history
        await prisma.scanHistory.create({
            data: {
                userId: req.user.id,
                wallet: wallet.toLowerCase(),
                score: result.score,
                category: result.category,
                flags: result.flags
            }
        });

        await logAudit(req, wallet, result, null);

        res.json({
            wallet: wallet.toLowerCase(),
            score: result.score,
            category: result.category,
            flags: result.flags,
            creditsRemaining: req.user.credits - 1, // Will represent state accurately before next DB pull
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[user score error]', err);
        res.status(err.status || 500).json({ error: 'failed to process risk score', code: 500 });
    }
});

// Secure Profile & History Retrieval (IDOR Protected)
app.get('/v1/user/profile', requireSupabaseAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                history: {
                    orderBy: { timestamp: 'desc' },
                    take: 50
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        res.json({
            email: user.email,
            credits: user.credits,
            history: user.history
        });
    } catch (err) {
        console.error('[profile error]', err);
        res.status(500).json({ error: 'failed to load profile data' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'request body too large', code: 413 });
    }
    next(err);
});

app.listen(PORT, () => {
    console.log(`sentinelpay API v2 running on port ${PORT}`);
});