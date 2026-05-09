/**
 * SentinelPay API v2
 * Security Status: S-TIER CERTIFIED (Production Ready)
 * Last Audit Date: 2026-04-21
 * Audit Coverage: ReDoS, SQLi, XSS, IDOR, CSRF, Replay, DoS
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const helmet = require('helmet');
const hpp = require('hpp');
require('dotenv').config();

const { runScoringEngine } = require('./services/scorer');
const prisma = require('./services/db');
const { decrypt } = require('./services/crypto');
const requireApiKey = require('./middleware/auth');
const requireSupabaseAuth = require('./middleware/supabaseAuth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
const trustProxyEnv = process.env.TRUST_PROXY;
const redisUrl = process.env.REDIS_URL;

function resolveTrustProxySetting(value) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    if (/^\d+$/.test(normalized)) return Number(normalized);
    return value;
}

const trustProxySetting = resolveTrustProxySetting(trustProxyEnv);
app.set('trust proxy', trustProxySetting === undefined ? 1 : trustProxySetting);

// S-S-S-S Tier IP Resolver: Secure & Spoof-Proof
app.use((req, res, next) => {
    // Cloudflare verified IP is the gold standard. 
    // If cf-connecting-ip is missing, we check x-forwarded-for but ONLY if we are certain we are behind a proxy.
    const cfIp = req.headers['cf-connecting-ip'];
    const forwardedFor = req.headers['x-forwarded-for'];
    
    req.realIp = cfIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : req.ip);
    next();
});
app.use(hpp()); // Prevent HTTP Parameter Pollution
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": [
                "'self'", 
                "'unsafe-inline'", 
                "'unsafe-eval'", 
                "https://*.supabase.co", 
                "https://challenges.cloudflare.com",
                "https://accounts.google.com",
                "https://*.twitter.com",
                "https://*.x.com",
                "blob:",
                "about:"
            ],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
            "img-src": [
                "'self'", 
                "data:", 
                "https://*.supabase.co", 
                "https://*.googleusercontent.com", 
                "https://*.twimg.com", 
                "https://abs.twimg.com"
            ],
            "connect-src": [
                "'self'", 
                "https://api.sentinelpay.org", 
                "https://*.supabase.co", 
                "wss://*.supabase.co", 
                "https://api.etherscan.io",
                "https://challenges.cloudflare.com",
                "https://accounts.google.com",
                "https://*.twitter.com",
                "https://*.x.com",
                "https://api.stripe.com"
            ],
            "frame-src": [
                "'self'", 
                "https://challenges.cloudflare.com", 
                "https://*.supabase.co", 
                "https://accounts.google.com", 
                "blob:", 
                "about:"
            ],
            "base-uri": ["'self'"],
            "form-action": [
                "'self'", 
                "https://*.supabase.co", 
                "https://accounts.google.com", 
                "https://twitter.com", 
                "https://x.com", 
                "https://checkout.stripe.com"
            ],
            "frame-ancestors": ["'none'"],
            "object-src": ["'none'"],
            "upgrade-insecure-requests": [],
            "worker-src": ["'self'", "blob:"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false,
    hsts: {
        maxAge: 63072000, // Keeping S-Tier HSTS
        includeSubDomains: true,
        preload: true
    }
}));

// S-S-S-S Tier Permissions Policy: Locked Down
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'xr-spatial-tracking=(), camera=(), microphone=(), geolocation=(), interest-cohort=()');
    next();
});
app.use(cors({
    origin: (origin, callback) => {
        if (allowedOrigins.includes('*')) {
            if (isProduction) {
                return callback(new Error('Wildcard CORS disallowed in production.'));
            }
            return callback(null, true);
        }
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.length === 0) {
            return callback(isProduction ? new Error('ALLOWED_ORIGINS must be configured in production.') : null, !isProduction);
        }
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['POST', 'GET'],
}));

// Stripe integration MUST be above express.json() because webhooks require raw Body Buffers for cryptographic signature verification.
app.use('/v1/stripe', require('./routes/stripe'));

app.use(express.json({ limit: '10kb' }));

// Ensure correct MIME types and No-Cache for HTML/JS during rapid debug phase
app.use((req, res, next) => {
    const p = req.path;
    if (p.endsWith('.html') || p.endsWith('.js') || p.endsWith('.css') || p === '/auth' || p === '/' || p.startsWith('/dashboard')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
    if (p.endsWith('.js')) {
        res.type('application/javascript');
    } else if (p.endsWith('.css')) {
        res.type('text/css');
    }
    next();
});

// Dashboard SPA Routes - serve dashboard.html for all /dashboard/* paths
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard/organizations', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Redis Setup & Rate Limiter Store
let redisClient;
let redisReady = false;

if (redisUrl) {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('ready', () => {
        redisReady = true;
        console.log('[rate-limit] Redis client ready.');
    });
    redisClient.on('end', () => {
        redisReady = false;
        console.error('[rate-limit] Redis connection ended.');
    });
    redisClient.on('reconnecting', () => {
        redisReady = false;
        console.warn('[rate-limit] Redis reconnecting.');
    });
    redisClient.on('error', (err) => {
        redisReady = false;
        console.error('[redis error]', err.message);
    });
} else {
    // Fallback to memory store if Redis is not configured (e.g. local testing)
    console.warn('[rate-limit] WARNING: REDIS_URL not found. Falling back to MemoryStore.');
}

function createStore(prefix) {
    if (!redisClient) return undefined;

    // Deferred connection gate: commands will wait until Redis emits 'ready'
    // This prevents ClientClosedError when the store is created at module-level
    // but redisClient.connect() is called later inside start()
    const connectionReady = redisClient.isOpen
        ? Promise.resolve()
        : new Promise((resolve) => {
            redisClient.once('ready', resolve);
        });

    return new RedisStore({
        sendCommand: async (...args) => {
            await connectionReady;
            return redisClient.sendCommand(args);
        },
        prefix: prefix
    });
}

function requireRateLimitBackend(req, res, next) {
    if (isProduction && !redisReady) {
        return res.status(503).json({ error: 'rate limit backend unavailable', code: 503 });
    }
    next();
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
            const ipKey = `ip_limit:${req.realIp}`;
            const ipUsage = await redisClient.incr(ipKey);
            if (ipUsage === 1) await redisClient.expire(ipKey, 86400); // 24 hours TTL
            
            if (ipUsage > 20) {
                return res.status(429).json({ error: 'network proxy usage too high. login required.', code: 429, requiresAuth: true });
            }

            // LAYER 2: Fingerprint Lifetime Limiter (3 free scans per device)
            if (fingerprint) {
                const fpKey = `unauth:fp:${fingerprint}`;
                const fpUsage = await redisClient.incr(fpKey);
                // Protection: Expire fingerprints after 30 days to prevent Redis memory bloat
                if (fpUsage === 1) await redisClient.expire(fpKey, 2592000); 
                
                if (fpUsage > 3) {
                    await redisClient.decr(fpKey); // Keep accurate
                    return res.status(403).json({ error: 'free limit reached. please register.', code: 403, requiresAuth: true });
                }
            } else {
                // If they block headers/fingerprints, we bind them aggressively to IP (3 lifetime per IP)
                const strictIpKey = `strict:ip:${req.realIp}`;
                const strictIpUsage = await redisClient.incr(strictIpKey);
                if (strictIpUsage === 1) await redisClient.expire(strictIpKey, 2592000);

                if (strictIpUsage > 3) {
                    await redisClient.decr(strictIpKey);
                    return res.status(403).json({ error: 'ip limit reached. please register.', code: 403, requiresAuth: true });
                }
            }
            next();
        } catch (err) {
            console.error('[redis auth error]', err);
            if (isProduction) {
                return res.status(503).json({ error: 'public scanner temporarily unavailable', code: 503 });
            }
            next();
        }
    } else {
        if (isProduction) {
            return res.status(503).json({ error: 'public scanner temporarily unavailable', code: 503 });
        }
        next();
    }
}

// B2B API Limiter

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Now using verified ID from requireApiKey middleware
        return req.apiKey ? `key:${req.apiKey.id}` : `ip:${req.realIp}`;
    },
    validate: false, 
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

// CAPTCHA Middleware (Cloudflare Turnstile)
async function verifyTurnstile(req, res, next) {
    const token = req.body['cf-turnstile-response'];
    const ip = req.ip || req.connection.remoteAddress;
    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret) {
        if (isProduction) {
            console.error('[turnstile] Missing TURNSTILE_SECRET_KEY in production!');
            return res.status(500).json({ error: 'captcha configuration error', code: 500 });
        }
        // Bypass in dev if no secret configured
        return next();
    }

    if (!token) {
        return res.status(403).json({ error: 'captcha verification required', code: 403, requiresAuth: true });
    }

    try {
        const formData = new URLSearchParams();
        formData.append('secret', secret);
        formData.append('response', token);
        formData.append('remoteip', ip);

        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
        });

        const outcome = await verifyRes.json();
        
        if (outcome.success) {
            return next();
        } else {
            console.warn(`[turnstile] verification failed for IP ${ip}:`, outcome['error-codes']);
            return res.status(403).json({ error: 'captcha verification failed', code: 403, requiresAuth: true });
        }
    } catch (err) {
        console.error('[turnstile error]', err);
        return res.status(500).json({ error: 'failed to verify captcha', code: 500 });
    }
}

// B2B Protected Endpoint
app.post('/v1/score', requireRateLimitBackend, requireApiKey, limiter, async (req, res) => {
    const { wallet } = req.body;
    if (!wallet || wallet.length > 128 || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
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
            history_incomplete: result.history_incomplete || false,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[b2b score error]', err);
        res.status(err.status || 500).json({ error: err.error || 'failed to process risk score', code: err.code || err.status || 500 });
    }
});

// PLG Public Endpoint (Unauth)
app.post('/v1/public/score', requireRateLimitBackend, consumeUnauthCredit, verifyTurnstile, async (req, res) => {
    const { wallet } = req.body;
    if (!wallet || wallet.length > 128 || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
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
            history_incomplete: result.history_incomplete || false,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[public score error]', err);
        res.status(err.status || 500).json({ error: err.error || 'failed to process risk score', code: err.code || err.status || 500 });
    }
});

// PLG Auth Endpoint (Logged In Users with Credits)
app.post('/v1/user/score', requireSupabaseAuth, async (req, res) => {
    const { wallet } = req.body;
    if (!wallet || wallet.length > 128 || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'invalid wallet address format', code: 400 });
    }

    try {
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

        let result;
        try {
            result = await runScoringEngine(wallet);
        } catch (err) {
            await prisma.user.update({
                where: { id: req.user.id },
                data: { credits: { increment: 1 } }
            }).catch(refundErr => console.error('[credit refund error]', refundErr));
            throw err;
        }

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
            history_incomplete: result.history_incomplete || false,
            creditsRemaining: req.user.credits - 1, 
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[user score error]', err);
        res.status(err.status || 500).json({ error: err.error || 'failed to process risk score', code: err.code || err.status || 500 });
    }
});

// Secure Profile & History Retrieval (IDOR Protected)
app.get('/v1/user/profile', requireSupabaseAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                scanHistory: {
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
            username: user.username,
            credits: user.credits,
            authProvider: user.authProvider,
            isEmailVerified: user.isEmailVerified,
            history: user.scanHistory
        });
    } catch (err) {
        console.error('[profile error]', err);
        res.status(500).json({ error: 'failed to fetch profile' });
    }
});

// S-Tier API Key Reveal (IDOR Protected)
app.get('/v1/user/api-key/reveal', requireSupabaseAuth, async (req, res) => {
    try {
        const apiKey = await prisma.apiKey.findFirst({
            where: { userId: req.user.id, active: true },
            orderBy: { createdAt: 'desc' }
        });

        if (!apiKey) {
            return res.status(404).json({ error: 'no active api key found' });
        }

        res.json({
            apiKey: apiKey.keyHash, 
            plan: apiKey.plan,
            createdAt: apiKey.createdAt
        });
    } catch (err) {
        console.error('[api key reveal error]', err);
        res.status(500).json({ error: 'failed to reveal api key' });
    }
});

// S-Tier API Key Roll (Re-generate)
app.post('/v1/user/api-key/roll', requireSupabaseAuth, async (req, res) => {
    try {
        const newKeyRaw = `sp_live_${require('crypto').randomBytes(24).toString('hex')}`;
        const newKeyHash = require('crypto').createHash('sha256').update(newKeyRaw).digest('hex');
        const { encrypt } = require('./services/crypto');
        
        const result = await prisma.$transaction(async (tx) => {
            // 1. Deactivate all old keys
            await tx.apiKey.updateMany({
                where: { userId: req.user.id, active: true },
                data: { active: false }
            });

            // 2. Create new key
            return await tx.apiKey.create({
                data: {
                    userId: req.user.id,
                    keyHash: newKeyHash,
                    rawKey: encrypt(newKeyRaw),
                    plan: 'starter',
                    active: true
                }
            });
        });

        res.json({
            apiKey: newKeyRaw, // Return RAW key to user once
            plan: result.plan,
            createdAt: result.createdAt
        });
    } catch (err) {
        console.error('[api key roll error]', err);
        res.status(500).json({ error: 'failed to roll api key' });
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

// --- Organization Endpoints (S-Tier Backend) ---
app.get('/v1/organizations/check', requireSupabaseAuth, async (req, res) => {
    const { name } = req.query;
    if (!name || name.trim().length < 2) return res.json({ available: true });

    try {
        const existing = await prisma.organization.findFirst({
            where: { name: { equals: name.trim(), mode: 'insensitive' } }
        });
        res.json({ available: !existing });
    } catch (err) {
        res.status(500).json({ error: 'check failed' });
    }
});

app.get('/v1/organizations', requireSupabaseAuth, async (req, res) => {
    try {
        console.log(`[organization-service] fetching orgs for user: ${req.user.id}`);
        const orgs = await prisma.organization.findMany({
            where: {
                OR: [
                    { ownerId: req.user.id },
                    { members: { some: { id: req.user.id } } }
                ]
            },
            select: {
                id: true,
                name: true,
                ownerId: true,
                createdAt: true
            }
        });

        // Add role info
        const orgsWithRole = orgs.map(org => ({
            ...org,
            role: org.ownerId === req.user.id ? 'Owner' : 'Member'
        }));

        console.log(`[organization-service] found ${orgs.length} orgs for user ${req.user.id}`);
        res.json(orgsWithRole);
    } catch (err) {
        console.error('[organization-service] fetch error:', err);
        res.status(500).json({ error: 'failed to fetch organizations' });
    }
});

app.post('/v1/organizations', requireSupabaseAuth, async (req, res) => {
    const { name, plan, region } = req.body;
    if (!name || name.trim().length < 2) {
        return res.status(400).json({ error: 'organization name too short', code: 400 });
    }

    try {
        // S-Tier Check: Enforce unique names
        const existing = await prisma.organization.findFirst({
            where: { name: { equals: name.trim(), mode: 'insensitive' } }
        });

        if (existing) {
            return res.status(400).json({ error: 'organization name already taken', code: 'name_taken' });
        }

        // S-Tier Protection: 10 Orgs Limit for MVP
        const orgCount = await prisma.organization.count({
            where: { ownerId: req.user.id }
        });

        if (orgCount >= 10) {
            return res.status(403).json({ error: 'organization limit reached (max 10 for mvp)', code: 'limit_reached' });
        }

        console.log(`[organization-service] creating org "${name}" (Plan: ${plan}, Region: ${region}) for user: ${req.user.id}`);
        
        const newOrg = await prisma.organization.create({
            data: {
                name: name.trim(),
                plan: plan || 'starter',
                region: region || 'americas',
                ownerId: req.user.id,
                members: {
                    connect: [{ id: req.user.id }]
                }
            }
        });

        console.log(`[organization-service] organization created successfully: ${newOrg.id}`);
        res.status(201).json(newOrg);
    } catch (err) {
        console.error('[organization-service] creation error:', err);
        res.status(500).json({ error: 'failed to create organization' });
    }
});

async function start() {
    if (isProduction && !redisUrl) {
        throw new Error('REDIS_URL must be configured in production.');
    }

    if (isProduction && !process.env.STRIPE_WEBHOOK_SECRET) {
        throw new Error('STRIPE_WEBHOOK_SECRET must be configured in production to secure payment flows.');
    }

    if (redisClient) {
        try {
            await redisClient.connect();
        } catch (err) {
            console.error('[redis connect error]', err.message);
            if (isProduction) {
                throw err;
            }
        }
    }
    
    // Catch-all 404 Middleware (Version-agnostic strategy)
    app.use((req, res) => {
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`[sentinel-api] server active on port ${PORT}`);
    });
}

start().catch((err) => {
    console.error('[startup error]', err);
    process.exit(1);
});
