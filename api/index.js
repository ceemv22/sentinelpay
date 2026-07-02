const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { createClient } = require('redis');
const helmet = require('helmet');
const hpp = require('hpp');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { runScoringEngine } = require('./services/scorer');
const prisma = require('./services/db');
const { encrypt, decrypt } = require('./services/crypto');
const requireApiKey = require('./middleware/auth');
const requireSupabaseAuth = require('./middleware/supabaseAuth');

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

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

app.use((req, res, next) => {
    const cfIp = req.headers['cf-connecting-ip'];
    const forwardedFor = req.headers['x-forwarded-for'];
    
    req.realIp = cfIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : req.ip);
    next();
});

app.use((req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const ip = req.realIp || req.ip;
    const isStatic = req.path.match(/\.(css|js|png|jpg|jpeg|svg|gif|ico|woff|woff2|webp)$/);
    
    res.on('finish', () => {
        if (!isStatic) {
            const duration = Date.now() - start;
            console.log(`[MONITOR] ${timestamp} | IP: ${ip.padEnd(15)} | ${req.method.padEnd(4)} | ${res.statusCode} | ${req.originalUrl} (${duration}ms)`);
        }
    });
    next();
});

if (process.env.STAGING_BASIC_AUTH) {
    const sepIdx = process.env.STAGING_BASIC_AUTH.indexOf(':');
    const stagingUser = process.env.STAGING_BASIC_AUTH.slice(0, sepIdx);
    const stagingPass = process.env.STAGING_BASIC_AUTH.slice(sepIdx + 1);
    const expectedHash = crypto.createHash('sha256').update(`${stagingUser}:${stagingPass}`).digest();
    app.use((req, res, next) => {
        const auth = req.headers['authorization'];
        if (auth && auth.startsWith('Basic ')) {
            const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
            const providedHash = crypto.createHash('sha256').update(decoded).digest();
            if (crypto.timingSafeEqual(providedHash, expectedHash)) {
                return next();
            }
        }
        res.set('WWW-Authenticate', 'Basic realm="sentinel-staging"');
        return res.status(401).end('unauthorized');
    });
}

app.use(hpp());
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
                "https://js.stripe.com",
                "https://widget.intercom.io",
                "https://js.intercomcdn.com",
                "https://*.intercomcdn.com",
                "https://*.intercom.io",
                "blob:",
                "about:"
            ],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.intercomcdn.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com", "https://fonts.intercomcdn.com"],
            "img-src": [
                "'self'",
                "data:",
                "https://*.supabase.co",
                "https://*.googleusercontent.com",
                "https://*.twimg.com",
                "https://abs.twimg.com",
                "https://cdn.jsdelivr.net",
                "https://*.intercomcdn.com",
                "https://*.intercom.io",
                "https://*.intercomassets.com"
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
                "https://api.stripe.com",
                "https://*.stripe.com",
                "https://*.stripe.network",
                "https://api-iam.intercom.io",
                "https://*.intercom.io",
                "https://uploads.intercomcdn.com",
                "https://uploads.intercomusercontent.com",
                "https://*.intercomcdn.com",
                "wss://nexus-websocket-a.intercom.io",
                "wss://nexus-websocket-b.intercom.io",
                "wss://*.intercom.io",
                "wss://*.intercom-messenger.com"
            ],
            "frame-src": [
                "'self'",
                "https://challenges.cloudflare.com",
                "https://*.supabase.co",
                "https://accounts.google.com",
                "https://js.stripe.com",
                "https://*.stripe.com",
                "https://intercom-sheets.com",
                "https://*.intercom.io",
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
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true
    }
}));

app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'xr-spatial-tracking=(), camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), ambient-light-sensor=(), accelerometer=(), gyroscope=(), magnetometer=(), display-capture=()');
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
    methods: ['POST', 'GET', 'DELETE'],
}));

app.use('/v1/stripe', require('./routes/stripe'));
app.use('/v1/crypto', require('./routes/crypto'));

app.use(express.json({ limit: '10kb' }));

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

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard/organizations', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard/org/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard/org/:slug/team', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get(/^\/dashboard(\/.*)?$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'join.html'));
});

app.get('/auth/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.get('/auth/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

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
    console.warn('[rate-limit] WARNING: REDIS_URL not found. Falling back to MemoryStore.');
}

function createStore(prefix) {
    if (!redisClient) return undefined;

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

async function consumeUnauthCredit(req, res, next) {
    const rawFp = req.headers['x-fingerprint'];
    const fingerprint = (typeof rawFp === 'string') && rawFp.trim().length > 0 ? rawFp.substring(0, 64) : null;

    if (redisClient) {
        try {
            const ipKey = `ip_limit:${req.realIp}`;
            const ipUsage = await redisClient.incr(ipKey);
            if (ipUsage === 1) await redisClient.expire(ipKey, 86400);
            
            if (ipUsage > 20) {
                return res.status(429).json({ error: 'network proxy usage too high. login required.', code: 429, requiresAuth: true });
            }

            if (fingerprint) {
                const fpKey = `unauth:fp:${fingerprint}`;
                const fpUsage = await redisClient.incr(fpKey);
                if (fpUsage === 1) await redisClient.expire(fpKey, 2592000);
                if (fpUsage > 3) {
                    await redisClient.decr(fpKey);
                    return res.status(403).json({ error: 'free limit reached. please register.', code: 403, requiresAuth: true });
                }
            } else {
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

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.apiKey ? `key:${req.apiKey.id}` : `ip:${req.realIp}`;
    },
    validate: false,
    store: createStore('b2b:'),
    message: { error: 'request limit exceeded. try again in 15 minutes.', code: 429 }
});

const userScoreLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `user_score:${req.user?.id || req.realIp}`,
    validate: false,
    store: createStore('user_score:'),
    message: { error: 'score request limit exceeded. try again in 15 minutes.', code: 429 }
});

const usernameLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `username_login:${req.realIp}`,
    validate: false,
    store: createStore('username_login:'),
    message: { error: 'too many requests. try again in 15 minutes.', code: 429 }
});

const userKeyRollLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `user_roll:${req.user?.id || req.realIp}`,
    validate: false,
    store: createStore('user_roll:'),
    message: { error: 'api key roll limit exceeded. try again in 1 hour.', code: 429 }
});

const userOrgLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `user_org:${req.user?.id || req.realIp}`,
    validate: false,
    store: createStore('user_org:'),
    message: { error: 'organization creation limit exceeded. try again in 1 hour.', code: 429 }
});

async function logAudit(req, wallet, result, apiKeyId = null) {
    const ip = req.realIp || req.ip;
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

async function verifyTurnstile(req, res, next) {
    const token = req.body['cf-turnstile-response'];
    const ip = req.realIp || req.ip;
    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret) {
        if (isProduction) {
            console.error('[turnstile] Missing TURNSTILE_SECRET_KEY in production!');
            return res.status(500).json({ error: 'captcha configuration error', code: 500 });
        }
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

app.use('/v1/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

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

app.post('/v1/user/score', requireRateLimitBackend, requireSupabaseAuth, userScoreLimiter, async (req, res) => {
    const { wallet } = req.body;
    if (!wallet || wallet.length > 128 || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'invalid wallet address format', code: 400 });
    }

    try {
        const updatedUser = await prisma.user.updateMany({
            where: {
                id: req.user.id,
                credits: { gt: 0 }
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
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            credits: user.credits,
            authProvider: user.authProvider,
            isEmailVerified: user.isEmailVerified,
            theme: user.theme || 'dark',
            timezone: user.timezone || 'auto',
            shortcuts: user.shortcuts ?? null,
            telemetry: user.telemetry === true,
            deletionRequestedAt: user.deletionRequestedAt || null,
            history: user.scanHistory
        });
    } catch (err) {
        console.error('[profile error]', err);
        res.status(500).json({ error: 'failed to fetch profile' });
    }
});

app.get('/v1/geo/timezone', requireSupabaseAuth, async (req, res) => {
    try {
        const ip = req.realIp || req.ip || '';
        const isPrivate = !ip || /^(127\.|10\.|192\.168\.|::1|fc|fd|172\.(1[6-9]|2\d|3[01])\.)/i.test(ip);
        const url = isPrivate ? 'https://ipwho.is/' : `https://ipwho.is/${encodeURIComponent(ip)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        let data = null;
        try {
            const r = await fetch(url, { signal: controller.signal });
            if (r.ok) data = await r.json();
        } finally {
            clearTimeout(timer);
        }
        if (data && data.success && data.timezone && data.timezone.id) {
            return res.json({ timezone: data.timezone.id, country: data.country_code || null });
        }
        return res.json({ timezone: null, country: null });
    } catch (err) {
        return res.json({ timezone: null, country: null });
    }
});

app.patch('/v1/user/profile', requireSupabaseAuth, async (req, res) => {
    try {
        const { firstName, lastName, username } = req.body;
        const data = {};
        const NAME_RE = /^[a-zA-Z ]*$/;
        if (typeof firstName === 'string') {
            const fn = firstName.trim();
            if (fn.length > 32) return res.status(400).json({ error: 'first name must be at most 32 characters' });
            if (!NAME_RE.test(fn)) return res.status(400).json({ error: 'first name cannot contain symbols or numbers' });
            data.firstName = fn;
        }
        if (typeof lastName === 'string') {
            const ln = lastName.trim();
            if (ln.length > 32) return res.status(400).json({ error: 'last name must be at most 32 characters' });
            if (!NAME_RE.test(ln)) return res.status(400).json({ error: 'last name cannot contain symbols or numbers' });
            data.lastName = ln;
        }
        if (typeof username === 'string') {
            const u = username.trim();
            const usernameChanged = u.toLowerCase() !== (req.user.username || '').toLowerCase();
            if (usernameChanged && req.user.authProvider !== 'twitter') {
                const verified = usernameChangeVerifiedStore.get(req.user.id);
                if (!verified || Date.now() > verified.expiresAt) {
                    return res.status(403).json({ error: 'identity verification required' });
                }
                usernameChangeVerifiedStore.delete(req.user.id);
            }
            if (u.length === 0) {
                data.username = null;
            } else if (/\s/.test(u)) {
                return res.status(400).json({ error: 'username cannot contain spaces' });
            } else if (!/^[a-zA-Z0-9]+$/.test(u)) {
                return res.status(400).json({ error: 'username cannot contain symbols' });
            } else if (u.length < 2 || u.length > 16) {
                return res.status(400).json({ error: 'username must be between 2 and 16 characters' });
            } else {
                const taken = await prisma.user.findFirst({
                    where: { username: { equals: u, mode: 'insensitive' }, NOT: { id: req.user.id } }
                });
                if (taken) return res.status(409).json({ error: 'username is already taken' });
                data.username = u;
            }
        }
        if (typeof req.body.theme === 'string') {
            const t = req.body.theme.trim().toLowerCase();
            if (!['dark', 'light', 'system'].includes(t)) return res.status(400).json({ error: 'invalid theme' });
            data.theme = t;
        }
        if (typeof req.body.timezone === 'string') {
            const tz = req.body.timezone.trim();
            if (tz.length > 64) return res.status(400).json({ error: 'invalid timezone' });
            if (tz !== 'auto') {
                try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch (e) { return res.status(400).json({ error: 'invalid timezone' }); }
            }
            data.timezone = tz;
        }
        if (req.body.shortcuts !== undefined) {
            const sc = req.body.shortcuts;
            if (sc === null) {
                data.shortcuts = null;
            } else if (typeof sc === 'object' && !Array.isArray(sc)) {
                const keys = Object.keys(sc);
                if (keys.length > 50) return res.status(400).json({ error: 'invalid shortcuts' });
                for (const k of keys) {
                    if (typeof k !== 'string' || k.length > 40 || typeof sc[k] !== 'boolean') {
                        return res.status(400).json({ error: 'invalid shortcuts' });
                    }
                }
                data.shortcuts = sc;
            } else {
                return res.status(400).json({ error: 'invalid shortcuts' });
            }
        }
        if (req.body.telemetry !== undefined) {
            if (typeof req.body.telemetry !== 'boolean') return res.status(400).json({ error: 'invalid telemetry value' });
            if (req.body.telemetry === true && !req.user.email) {
                return res.status(400).json({ error: 'a primary email is required to enable telemetry' });
            }
            data.telemetry = req.body.telemetry;
        }
        if (Object.keys(data).length === 0) return res.status(400).json({ error: 'nothing to update' });
        let user;
        try {
            user = await prisma.user.update({ where: { id: req.user.id }, data });
        } catch (err) {
            if (err.code === 'P2002' && err.meta?.target?.includes('username')) {
                return res.status(409).json({ error: 'username is already taken' });
            }
            throw err;
        }
        res.json({ ok: true, email: user.email, username: user.username, firstName: user.firstName || '', lastName: user.lastName || '', theme: user.theme || 'dark', timezone: user.timezone || 'auto', shortcuts: user.shortcuts ?? null, telemetry: user.telemetry === true });
    } catch (err) {
        console.error('[profile patch error]', err);
        res.status(500).json({ error: 'failed to update profile' });
    }
});

const USERNAME_LOGIN_RE = /^[a-zA-Z0-9]{2,16}$/;

app.post('/v1/auth/resolve-login', requireRateLimitBackend, usernameLoginLimiter, async (req, res) => {
    try {
        const { identifier } = req.body;
        if (typeof identifier !== 'string' || !identifier.trim()) {
            return res.status(400).json({ error: 'identifier required' });
        }
        const value = identifier.trim();

        if (value.includes('@')) {
            return res.json({ email: value });
        }

        if (!USERNAME_LOGIN_RE.test(value)) {
            return res.status(400).json({ error: 'invalid username or email' });
        }

        const user = await prisma.user.findFirst({
            where: { username: { equals: value, mode: 'insensitive' } },
            select: { email: true }
        });

        if (!user) return res.status(404).json({ error: 'no account found' });
        res.json({ email: user.email });
    } catch (err) {
        console.error('[resolve-login error]', err);
        res.status(500).json({ error: 'failed to resolve login' });
    }
});

app.post('/v1/user/check-email', requireSupabaseAuth, async (req, res) => {
    try {
        const { email } = req.body;
        if (typeof email !== 'string' || !email.trim()) return res.status(400).json({ error: 'email required' });
        const trimmedEmail = email.trim();

        const existing = await prisma.user.findFirst({
            where: { email: { equals: trimmedEmail, mode: 'insensitive' }, NOT: { id: req.user.id } }
        });
        if (existing) return res.json({ available: false });

        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const adminRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(trimmedEmail)}`, {
                headers: {
                    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
                }
            });
            if (adminRes.ok) {
                const adminData = await adminRes.json();
                const users = adminData?.users || [];
                if (users.some(u => u.email && u.email.toLowerCase() === trimmedEmail.toLowerCase() && u.id !== req.user.supabaseId)) {
                    return res.json({ available: false });
                }
            }
        }

        res.json({ available: true });
    } catch (err) {
        console.error('[check-email error]', err);
        res.status(500).json({ error: 'failed to check email' });
    }
});

const emailOtpStore = new Map();

app.post('/v1/user/email-change/send-code', requireSupabaseAuth, async (req, res) => {
    try {
        if (!req.user.email) return res.status(400).json({ error: 'no email on file for this account' });

        const existing = emailOtpStore.get(req.user.id);
        if (existing && Date.now() - existing.sentAt < 60 * 1000) {
            const retryAfter = Math.ceil((60 * 1000 - (Date.now() - existing.sentAt)) / 1000);
            return res.status(429).json({ error: 'please wait before requesting another code', retryAfter });
        }

        const code = crypto.randomInt(100000, 1000000).toString();
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        emailOtpStore.set(req.user.id, {
            codeHash,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0,
            sentAt: Date.now()
        });

        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
            from: 'sentinelpay <noreply@sentinelpay.org>',
            to: req.user.email,
            subject: 'your sentinelpay verification code',
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>verification code | SentinelPay</title>
                <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
            </head>
            <body style="margin: 0; padding: 0; background-color: #050505; color: #ffffff; font-family: 'JetBrains Mono', 'Courier New', monospace; -webkit-font-smoothing: antialiased;">
                <div style="background-color: #050505; padding: 100px 20px; text-align: center;">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 50px;">
                        <tr>
                            <td align="center">
                                <img src="https://sentinelpay.org/logo.png" alt="SentinelPay" width="64" height="64" style="display: block; border: 0;">
                            </td>
                        </tr>
                    </table>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width: 420px; width: 100%; border-top: 1px solid rgba(255,255,255,0.05);">
                        <tr>
                            <td style="padding: 40px 0;">
                                <h1 style="font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 800; letter-spacing: -1.5px; margin: 0 0 25px 0; color: #ffffff; text-transform: lowercase;">verify it's you</h1>
                                <p style="font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.6; color: #777777; margin: 0 0 35px 0;">
                                    use this code to confirm the email change request on your sentinelpay account. it expires in 10 minutes.
                                </p>
                                <div style="font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #ffffff; margin: 0 0 35px 0;">${code}</div>
                                <p style="font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6; color: #555555; margin: 0;">
                                    if you didn't request this, you can safely ignore this email.
                                </p>
                            </td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>`
        });

        res.json({ ok: true });
    } catch (err) {
        console.error('[email-otp send error]', err);
        res.status(500).json({ error: 'failed to send verification code' });
    }
});

app.post('/v1/user/email-change/verify-code', requireSupabaseAuth, async (req, res) => {
    try {
        const { code } = req.body;
        if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) {
            return res.status(400).json({ error: 'invalid code format' });
        }

        const entry = emailOtpStore.get(req.user.id);
        if (!entry) return res.status(400).json({ error: 'no verification code requested' });
        if (Date.now() > entry.expiresAt) {
            emailOtpStore.delete(req.user.id);
            return res.status(400).json({ error: 'code expired. request a new one' });
        }
        if (entry.attempts >= 5) {
            emailOtpStore.delete(req.user.id);
            return res.status(429).json({ error: 'too many attempts. request a new code' });
        }

        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        if (codeHash !== entry.codeHash) {
            entry.attempts += 1;
            return res.status(400).json({ error: 'incorrect code' });
        }

        emailOtpStore.delete(req.user.id);
        res.json({ ok: true });
    } catch (err) {
        console.error('[email-otp verify error]', err);
        res.status(500).json({ error: 'failed to verify code' });
    }
});

const emailOtpNewStore = new Map();
const emailChangeVerifiedStore = new Map();

const NEW_EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

app.post('/v1/user/email-change/send-code-new', requireSupabaseAuth, async (req, res) => {
    try {
        const { newEmail } = req.body;
        if (typeof newEmail !== 'string' || !NEW_EMAIL_RE.test(newEmail.trim())) {
            return res.status(400).json({ error: 'invalid email' });
        }
        const target = newEmail.trim();

        const existing = emailOtpNewStore.get(req.user.id);
        if (existing && Date.now() - existing.sentAt < 60 * 1000) {
            const retryAfter = Math.ceil((60 * 1000 - (Date.now() - existing.sentAt)) / 1000);
            return res.status(429).json({ error: 'please wait before requesting another code', retryAfter });
        }

        const code = crypto.randomInt(100000, 1000000).toString();
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        emailOtpNewStore.set(req.user.id, {
            codeHash,
            email: target,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0,
            sentAt: Date.now()
        });

        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
            from: 'sentinelpay <noreply@sentinelpay.org>',
            to: target,
            subject: 'confirm your new sentinelpay email',
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>confirm new email | SentinelPay</title>
                <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
            </head>
            <body style="margin: 0; padding: 0; background-color: #050505; color: #ffffff; font-family: 'JetBrains Mono', 'Courier New', monospace; -webkit-font-smoothing: antialiased;">
                <div style="background-color: #050505; padding: 100px 20px; text-align: center;">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 50px;">
                        <tr><td align="center"><img src="https://sentinelpay.org/logo.png" alt="SentinelPay" width="64" height="64" style="display: block; border: 0;"></td></tr>
                    </table>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width: 420px; width: 100%; border-top: 1px solid rgba(255,255,255,0.05);">
                        <tr>
                            <td style="padding: 40px 0;">
                                <h1 style="font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 800; letter-spacing: -1.5px; margin: 0 0 25px 0; color: #ffffff; text-transform: lowercase;">confirm new email</h1>
                                <p style="font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.6; color: #777777; margin: 0 0 35px 0;">someone requested to link this address to a sentinelpay account. use this code to confirm. expires in 10 minutes.</p>
                                <div style="font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #ffffff; margin: 0 0 35px 0;">${code}</div>
                                <p style="font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6; color: #555555; margin: 0;">if you didn't request this, you can safely ignore this email.</p>
                            </td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>`
        });

        res.json({ ok: true });
    } catch (err) {
        console.error('[email-otp-new send error]', err);
        res.status(500).json({ error: 'failed to send verification code' });
    }
});

app.post('/v1/user/email-change/verify-code-new', requireSupabaseAuth, async (req, res) => {
    try {
        const { code } = req.body;
        if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) {
            return res.status(400).json({ error: 'invalid code format' });
        }

        const entry = emailOtpNewStore.get(req.user.id);
        if (!entry) return res.status(400).json({ error: 'no verification code requested' });
        if (Date.now() > entry.expiresAt) {
            emailOtpNewStore.delete(req.user.id);
            return res.status(400).json({ error: 'code expired. request a new one' });
        }
        if (entry.attempts >= 5) {
            emailOtpNewStore.delete(req.user.id);
            return res.status(429).json({ error: 'too many attempts. request a new code' });
        }

        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        if (codeHash !== entry.codeHash) {
            entry.attempts += 1;
            return res.status(400).json({ error: 'incorrect code' });
        }

        emailOtpNewStore.delete(req.user.id);
        emailChangeVerifiedStore.set(req.user.id, { email: entry.email, expiresAt: Date.now() + 10 * 60 * 1000 });
        res.json({ ok: true });
    } catch (err) {
        console.error('[email-otp-new verify error]', err);
        res.status(500).json({ error: 'failed to verify code' });
    }
});

const usernameOtpStore = new Map();
const usernameChangeVerifiedStore = new Map();

app.post('/v1/user/username-change/verify-password', requireSupabaseAuth, async (req, res) => {
    try {
        const { password, captchaToken } = req.body;
        if (typeof password !== 'string' || !password) {
            return res.status(400).json({ error: 'password required' });
        }
        if (!req.user.email) {
            return res.status(400).json({ error: 'no email on file for this account' });
        }

        const tokenRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                apikey: process.env.SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: req.user.email,
                password,
                gotrue_meta_security: { captcha_token: captchaToken }
            })
        });

        if (!tokenRes.ok) {
            return res.status(401).json({ error: 'incorrect password' });
        }

        usernameChangeVerifiedStore.set(req.user.id, { expiresAt: Date.now() + 10 * 60 * 1000 });
        res.json({ ok: true });
    } catch (err) {
        console.error('[username-change verify-password error]', err);
        res.status(500).json({ error: 'verification failed' });
    }
});

app.post('/v1/user/username-change/send-code', requireSupabaseAuth, async (req, res) => {
    try {
        if (!req.user.email) return res.status(400).json({ error: 'no email on file for this account' });

        const existing = usernameOtpStore.get(req.user.id);
        if (existing && Date.now() - existing.sentAt < 60 * 1000) {
            const retryAfter = Math.ceil((60 * 1000 - (Date.now() - existing.sentAt)) / 1000);
            return res.status(429).json({ error: 'please wait before requesting another code', retryAfter });
        }

        const code = crypto.randomInt(100000, 1000000).toString();
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        usernameOtpStore.set(req.user.id, {
            codeHash,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0,
            sentAt: Date.now()
        });

        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
            from: 'sentinelpay <noreply@sentinelpay.org>',
            to: req.user.email,
            subject: 'your sentinelpay verification code',
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>verification code | SentinelPay</title>
                <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
            </head>
            <body style="margin: 0; padding: 0; background-color: #050505; color: #ffffff; font-family: 'JetBrains Mono', 'Courier New', monospace; -webkit-font-smoothing: antialiased;">
                <div style="background-color: #050505; padding: 100px 20px; text-align: center;">
                    <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 50px;">
                        <tr><td align="center"><img src="https://sentinelpay.org/logo.png" alt="SentinelPay" width="64" height="64" style="display: block; border: 0;"></td></tr>
                    </table>
                    <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width: 420px; width: 100%; border-top: 1px solid rgba(255,255,255,0.05);">
                        <tr>
                            <td style="padding: 40px 0;">
                                <h1 style="font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 800; letter-spacing: -1.5px; margin: 0 0 25px 0; color: #ffffff; text-transform: lowercase;">verify it's you</h1>
                                <p style="font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.6; color: #777777; margin: 0 0 35px 0;">use this code to confirm the username change request on your sentinelpay account. it expires in 10 minutes.</p>
                                <div style="font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #ffffff; margin: 0 0 35px 0;">${code}</div>
                                <p style="font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6; color: #555555; margin: 0;">if you didn't request this, you can safely ignore this email.</p>
                            </td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>`
        });

        res.json({ ok: true });
    } catch (err) {
        console.error('[username-change send-code error]', err);
        res.status(500).json({ error: 'failed to send verification code' });
    }
});

app.post('/v1/user/username-change/verify-code', requireSupabaseAuth, async (req, res) => {
    try {
        const { code } = req.body;
        if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) {
            return res.status(400).json({ error: 'invalid code format' });
        }

        const entry = usernameOtpStore.get(req.user.id);
        if (!entry) return res.status(400).json({ error: 'no verification code requested' });
        if (Date.now() > entry.expiresAt) {
            usernameOtpStore.delete(req.user.id);
            return res.status(400).json({ error: 'code expired. request a new one' });
        }
        if (entry.attempts >= 5) {
            usernameOtpStore.delete(req.user.id);
            return res.status(429).json({ error: 'too many attempts. request a new code' });
        }

        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        if (codeHash !== entry.codeHash) {
            entry.attempts += 1;
            return res.status(400).json({ error: 'incorrect code' });
        }

        usernameOtpStore.delete(req.user.id);
        usernameChangeVerifiedStore.set(req.user.id, { expiresAt: Date.now() + 10 * 60 * 1000 });
        res.json({ ok: true });
    } catch (err) {
        console.error('[username-change verify-code error]', err);
        res.status(500).json({ error: 'failed to verify code' });
    }
});

app.post('/v1/user/email-change/finalize', requireSupabaseAuth, async (req, res) => {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return res.status(500).json({ error: 'email change is not configured on this server' });
        }

        const { email } = req.body;
        if (typeof email !== 'string' || !NEW_EMAIL_RE.test(email.trim())) {
            return res.status(400).json({ error: 'invalid email' });
        }
        const newEmail = email.trim();

        const verified = emailChangeVerifiedStore.get(req.user.id);
        if (!verified || verified.email.toLowerCase() !== newEmail.toLowerCase()) {
            return res.status(400).json({ error: 'email not verified' });
        }
        if (Date.now() > verified.expiresAt) {
            emailChangeVerifiedStore.delete(req.user.id);
            return res.status(400).json({ error: 'verification expired. start the email change again' });
        }

        const adminRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${req.user.supabaseId}`, {
            method: 'PUT',
            headers: {
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: newEmail, email_confirm: true })
        });

        if (!adminRes.ok) {
            const errBody = await adminRes.json().catch(() => ({}));
            const m = (errBody.msg || errBody.message || '').toLowerCase();
            if (m.includes('already') || m.includes('registered') || m.includes('exists')) {
                return res.status(409).json({ error: 'this email is already in use' });
            }
            console.error('[email-change finalize] admin update failed', errBody);
            return res.status(500).json({ error: 'failed to update email' });
        }

        await prisma.user.update({ where: { id: req.user.id }, data: { email: newEmail } });
        emailChangeVerifiedStore.delete(req.user.id);

        res.json({ ok: true });
    } catch (err) {
        console.error('[email-change finalize error]', err);
        res.status(500).json({ error: 'failed to update email' });
    }
});

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
            apiKey: decrypt(apiKey.rawKey),
            plan: apiKey.plan,
            createdAt: apiKey.createdAt
        });
    } catch (err) {
        console.error('[api key reveal error]', err);
        res.status(500).json({ error: 'failed to reveal api key' });
    }
});

app.post('/v1/user/api-key/roll', requireRateLimitBackend, requireSupabaseAuth, userKeyRollLimiter, async (req, res) => {
    try {
        const existing = await prisma.apiKey.findFirst({
            where: { userId: req.user.id, active: true },
            orderBy: { createdAt: 'desc' },
            select: { plan: true }
        });

        const newKeyRaw = `sp_live_${crypto.randomBytes(24).toString('hex')}`;
        const newKeyHash = crypto.createHash('sha256').update(newKeyRaw).digest('hex');

        const result = await prisma.$transaction(async (tx) => {
            await tx.apiKey.updateMany({
                where: { userId: req.user.id, active: true },
                data: { active: false }
            });

            return await tx.apiKey.create({
                data: {
                    userId: req.user.id,
                    keyHash: newKeyHash,
                    rawKey: encrypt(newKeyRaw),
                    plan: existing?.plan || 'starter',
                    active: true
                }
            });
        });

        res.json({
            apiKey: newKeyRaw,
            plan: result.plan,
            createdAt: result.createdAt
        });
    } catch (err) {
        console.error('[api key roll error]', err);
        res.status(500).json({ error: 'failed to roll api key' });
    }
});

app.post('/v1/user/account/deletion-request', requireSupabaseAuth, async (req, res) => {
    try {
        const ownedCount = await prisma.organization.count({ where: { ownerId: req.user.id } });
        if (ownedCount > 0) {
            return res.status(409).json({
                error: 'transfer ownership or delete your organizations before deleting your account',
                ownedCount,
                code: 'owns_organizations'
            });
        }

        const pending = await prisma.accountDeletionRequest.findFirst({
            where: { userId: req.user.id, status: 'pending' },
            orderBy: { requestedAt: 'desc' }
        });
        if (pending) {
            return res.json({ ok: true, requestedAt: pending.requestedAt });
        }

        const requestedAt = new Date();
        const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 400) : null;

        await prisma.$transaction(async (tx) => {
            await tx.accountDeletionRequest.create({
                data: {
                    userId: req.user.id,
                    email: req.user.email || null,
                    username: req.user.username || null,
                    status: 'pending',
                    ip: req.realIp || null,
                    userAgent,
                    requestedAt
                }
            });
            await tx.user.update({
                where: { id: req.user.id },
                data: { deletionRequestedAt: requestedAt }
            });
        });

        if (process.env.RESEND_API_KEY && req.user.email) {
                try {
                    const { Resend } = require('resend');
                    const resend = new Resend(process.env.RESEND_API_KEY);
                    await resend.emails.send({
                        from: 'sentinelpay <noreply@sentinelpay.org>',
                        to: req.user.email,
                        subject: 'account deletion requested',
                        html: `
                        <!DOCTYPE html>
                        <html lang="en">
                        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                        <body style="margin:0;padding:0;background-color:#050505;color:#ffffff;font-family:'JetBrains Mono','Courier New',monospace;-webkit-font-smoothing:antialiased;">
                            <div style="background-color:#050505;padding:100px 20px;text-align:center;">
                                <img src="https://sentinelpay.org/logo.png" alt="SentinelPay" width="64" height="64" style="display:block;margin:0 auto 40px;border:0;">
                                <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width:420px;width:100%;border-top:1px solid rgba(255,255,255,0.05);">
                                    <tr><td style="padding:40px 0;">
                                        <h1 style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:800;letter-spacing:-1px;margin:0 0 20px;color:#ffffff;text-transform:lowercase;">account deletion requested</h1>
                                        <p style="font-family:'JetBrains Mono',monospace;font-size:14px;line-height:1.7;color:#777777;margin:0;">we received a request to delete your sentinelpay account. your data will be removed within 30 days. if you didn't request this, contact support@sentinelpay.org immediately.</p>
                                    </td></tr>
                                </table>
                            </div>
                        </body>
                        </html>`
                    });
                } catch (mailErr) {
                    console.error('[deletion-request mail error]', mailErr.message);
                }
            }

        res.json({ ok: true, requestedAt });
    } catch (err) {
        console.error('[deletion-request error]', err);
        res.status(500).json({ error: 'failed to submit deletion request' });
    }
});

function requireAdmin(req, res, next) {
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) return res.status(503).json({ error: 'admin api not configured', code: 503 });
    const provided = req.headers['x-admin-key'];
    if (typeof provided !== 'string' || provided.length === 0) {
        return res.status(401).json({ error: 'unauthorized', code: 401 });
    }
    const a = crypto.createHash('sha256').update(provided).digest();
    const b = crypto.createHash('sha256').update(adminKey).digest();
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'unauthorized', code: 401 });
    }
    next();
}

app.get('/v1/admin/deletion-requests', requireAdmin, async (req, res) => {
    try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const ALLOWED = ['pending', 'processing', 'processed', 'cancelled'];
        const where = status && ALLOWED.includes(status) ? { status } : {};
        const rows = await prisma.accountDeletionRequest.findMany({
            where,
            orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
            take: 500
        });
        res.json(rows);
    } catch (err) {
        console.error('[admin deletion-requests list]', err);
        res.status(500).json({ error: 'failed to fetch deletion requests', code: 500 });
    }
});

app.patch('/v1/admin/deletion-requests/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (!id || id.length > 64 || !/^[a-zA-Z0-9-]+$/.test(id)) {
        return res.status(400).json({ error: 'invalid id', code: 400 });
    }
    const { status, note, processedBy } = req.body || {};
    const ALLOWED = ['pending', 'processing', 'processed', 'cancelled'];
    if (!ALLOWED.includes(status)) {
        return res.status(400).json({ error: 'invalid status', code: 400 });
    }
    try {
        const existing = await prisma.accountDeletionRequest.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'deletion request not found', code: 404 });

        const data = { status };
        if (typeof note === 'string') data.note = note.slice(0, 500);
        if (typeof processedBy === 'string') data.processedBy = processedBy.slice(0, 120);
        if (status === 'processed') data.processedAt = new Date();
        if (status === 'cancelled') data.cancelledAt = new Date();

        const updated = await prisma.$transaction(async (tx) => {
            const row = await tx.accountDeletionRequest.update({ where: { id }, data });
            if (status === 'cancelled') {
                await tx.user.update({ where: { id: existing.userId }, data: { deletionRequestedAt: null } }).catch(() => {});
            }
            return row;
        });

        res.json(updated);
    } catch (err) {
        console.error('[admin deletion-request update]', err);
        res.status(500).json({ error: 'failed to update deletion request', code: 500 });
    }
});

app.get('/v1/user/intercom-token', requireSupabaseAuth, (req, res) => {
    if (!process.env.INTERCOM_SECRET) return res.status(503).json({ error: 'not_configured' });
    const payload = { user_id: req.user.supabaseId };
    if (req.user.email) payload.email = req.user.email;
    if (req.user.username) payload.name = req.user.username;
    const token = jwt.sign(payload, process.env.INTERCOM_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'request body too large', code: 413 });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'invalid request body', code: 400 });
    }
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'cors policy violation', code: 403 });
    }
    console.error('[unhandled error]', err.message || err);
    if (!res.headersSent) {
        return res.status(500).json({ error: 'internal server error', code: 500 });
    }
});

app.get('/v1/organizations/check', requireSupabaseAuth, async (req, res) => {
    const { name } = req.query;
    if (!name || typeof name !== 'string' || name.trim().length < 2) return res.json({ available: true });
    if (name.length > 100) return res.json({ available: false });

    try {
        const existing = await prisma.organization.findFirst({
            where: { name: { equals: name.trim(), mode: 'insensitive' }, ownerId: req.user.id }
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
                slug: true,
                plan: true,
                ownerId: true,
                createdAt: true
            }
        });

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

app.post('/v1/organizations', requireRateLimitBackend, requireSupabaseAuth, userOrgLimiter, async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'organization name required', code: 400 });
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
        return res.status(400).json({ error: 'organization name must be 2–100 characters', code: 400 });
    }

    try {
        const existing = await prisma.organization.findFirst({
            where: { name: { equals: trimmedName, mode: 'insensitive' }, ownerId: req.user.id }
        });

        if (existing) {
            return res.status(400).json({ error: 'you already have an organization with this name', code: 'name_taken' });
        }

        const orgCount = await prisma.organization.count({
            where: { ownerId: req.user.id }
        });

        if (orgCount >= 10) {
            return res.status(403).json({ error: 'organization limit reached (max 10 for mvp)', code: 'limit_reached' });
        }

        const generateSlug = () => crypto.randomBytes(10).toString('hex');

        const newOrg = await prisma.organization.create({
            data: {
                name: trimmedName,
                slug: generateSlug(),
                plan: 'starter',
                region: 'americas',
                ownerId: req.user.id,
                members: {
                    connect: [{ id: req.user.id }]
                }
            }
        });

        console.log(`[organization-service] organization created: ${newOrg.id}`);
        res.status(201).json(newOrg);
    } catch (err) {
        console.error('[organization-service] creation error:', err);
        res.status(500).json({ error: 'failed to create organization' });
    }
});

const INVITE_EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

app.post('/v1/organizations/:slug/team/invite', requireSupabaseAuth, async (req, res) => {
    const { slug } = req.params;
    if (!/^[a-f0-9]{20}$/.test(slug)) return res.status(400).json({ error: 'invalid slug' });
    const { emailList, role } = req.body;
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
        return res.status(400).json({ error: 'no recipients specified' });
    }
    if (emailList.length > 10) {
        return res.status(400).json({ error: 'max 10 recipients per invite batch' });
    }

    try {
        if (redisClient) {
            const inviteKey = `invite_limit:${req.user.id}`;
            const inviteCount = await redisClient.incr(inviteKey);
            if (inviteCount === 1) await redisClient.expire(inviteKey, 3600);
            if (inviteCount > 20) {
                return res.status(429).json({ error: 'invitation rate limit exceeded', code: 429 });
            }
        }

        const org = await prisma.organization.findUnique({
            where: { slug },
            include: { owner: true }
        });

        if (!org) return res.status(404).json({ error: 'organization not found' });
        if (org.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'only owners can invite members' });
        }

        const invitations = [];
        const inviterName = req.user.username || req.user.email;

        const ALLOWED_ROLES = ['developer', 'admin'];
        for (const identifier of emailList) {
            let targetEmail = identifier;

            if (!identifier.includes('@')) {
                const user = await prisma.user.findFirst({
                    where: { username: { equals: identifier, mode: 'insensitive' } }
                });
                if (!user || !user.email) {
                    throw new Error('one or more recipients could not be resolved');
                }
                targetEmail = user.email;
            }

            if (!INVITE_EMAIL_REGEX.test(targetEmail)) {
                throw new Error(`invalid email address: ${targetEmail}`);
            }

            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 3);

            const inv = await prisma.invitation.create({
                data: {
                    email: targetEmail,
                    role: ALLOWED_ROLES.includes(role) ? role : 'developer',
                    orgId: org.id,
                    token: tokenHash,
                    invitedBy: inviterName,
                    expiresAt
                }
            });

            const joinUrl = `https://sentinelpay.org/join?token=${rawToken}&slug=${org.slug}&name=${encodeURIComponent(inviterName)}&email=${encodeURIComponent(targetEmail)}`;
            
            await resend.emails.send({
                from: 'sentinelpay <noreply@sentinelpay.org>',
                to: targetEmail,
                subject: `${inviterName} has invited you to join ${org.name}`,
                html: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>S-Tier Handshake | SentinelPay</title>
                    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
                </head>
                <body style="margin: 0; padding: 0; background-color: #050505; color: #ffffff; font-family: 'JetBrains Mono', 'Courier New', monospace; -webkit-font-smoothing: antialiased;">
                    <div style="background-color: #050505; padding: 100px 20px; text-align: center;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 50px;">
                            <tr>
                                <td align="center">
                                    <img src="https://sentinelpay.org/logo.png" alt="SentinelPay" width="64" height="64" style="display: block; border: 0;">
                                </td>
                            </tr>
                        </table>
                        <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width: 420px; width: 100%; border-top: 1px solid rgba(255,255,255,0.05);">
                            <tr>
                                <td style="padding: 40px 0;">
                                    <h1 style="font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 800; letter-spacing: -1.5px; margin: 0 0 25px 0; color: #ffffff; text-transform: lowercase;">you've been invited</h1>
                                    <p style="font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.6; color: #777777; margin: 0 0 45px 0;">
                                        <strong>${escapeHtml(inviterName)}</strong> invited you to join the <strong>${escapeHtml(org.name)}</strong> organization on sentinelpay. Complete the signature check to bridge your account to the scanning core.
                                    </p>
                                    <div style="margin-bottom: 45px;">
                                        <a href="${joinUrl}" style="background-color: #ffffff; color: #000000; padding: 20px 40px; text-decoration: none; font-weight: 800; font-size: 13px; font-family: 'JetBrains Mono', monospace; text-transform: lowercase; display: inline-block; box-shadow: 0 8px 24px rgba(0, 240, 255, 0.15);">
                                            accept invitation
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        </table>
                        <div style="max-width: 420px; margin: 0 auto; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.03); text-align: left;">
                            <div style="font-size: 10px; font-family: 'JetBrains Mono', monospace; color: #222; text-transform: uppercase; letter-spacing: 1px; line-height: 1.8;">
                                if you did not request this, ignore.
                            </div>
                        </div>
                    </div>
                </body>
                </html>
                `
            });

            invitations.push(inv);
        }

        res.status(201).json({ message: 'invitations dispatched successfully', count: invitations.length });
    } catch (err) {
        console.error('[invitation-service] error:', err);
        res.status(500).json({ error: 'failed to dispatch invitations' });
    }
});

app.post('/v1/organizations/:slug/team/join', requireSupabaseAuth, async (req, res) => {
    const { slug } = req.params;
    if (!/^[a-f0-9]{20}$/.test(slug)) return res.status(400).json({ error: 'invalid slug' });
    const { token: rawToken } = req.body;

    if (!rawToken || typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/i.test(rawToken)) {
        return res.status(400).json({ error: 'missing or invalid invitation token' });
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        const invite = await prisma.invitation.findUnique({
            where: { token: tokenHash },
            include: { org: true }
        });

        if (!invite || invite.accepted) {
            return res.status(404).json({ error: 'invalid or already used invitation' });
        }

        if (invite.expiresAt < new Date()) {
            return res.status(403).json({ error: 'invitation has expired' });
        }

        if (invite.email.toLowerCase() !== req.user.email.toLowerCase()) {
            return res.status(403).json({ error: 'this invitation was sent to a different email address' });
        }

        const alreadyMember = await prisma.organization.findFirst({
            where: { id: invite.orgId, members: { some: { id: req.user.id } } }
        });
        if (alreadyMember) {
            return res.status(409).json({ error: 'already a member of this organization' });
        }

        await prisma.$transaction([
            prisma.organization.update({
                where: { id: invite.orgId },
                data: {
                    members: {
                        connect: [{ id: req.user.id }]
                    }
                }
            }),
            prisma.invitation.update({
                where: { id: invite.id },
                data: { accepted: true }
            })
        ]);

        res.json({ message: 'successfully joined organization', slug: invite.org.slug });
    } catch (err) {
        console.error('[invitation-service] join error:', err);
        res.status(500).json({ error: 'failed to join organization' });
    }
});

app.get('/v1/user/pending-invitations', requireSupabaseAuth, async (req, res) => {
    try {
        if (!req.user.email) return res.json([]);
        const invitations = await prisma.invitation.findMany({
            where: { email: req.user.email, accepted: false, expiresAt: { gt: new Date() } },
            include: { org: { select: { name: true, slug: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(invitations.map(inv => ({
            id: inv.id, orgName: inv.org.name, orgSlug: inv.org.slug,
            role: inv.role, invitedBy: inv.invitedBy, createdAt: inv.createdAt
        })));
    } catch (err) {
        console.error('[pending-invitations] error:', err);
        res.status(500).json({ error: 'failed to fetch notifications' });
    }
});

app.post('/v1/user/pending-invitations/:inviteId/accept', requireSupabaseAuth, async (req, res) => {
    const { inviteId } = req.params;
    if (!inviteId || inviteId.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(inviteId)) {
        return res.status(400).json({ error: 'invalid invitation id' });
    }
    try {
        const invite = await prisma.invitation.findUnique({
            where: { id: inviteId }, include: { org: true }
        });
        if (!invite || invite.accepted) return res.status(404).json({ error: 'invitation not found or already used' });
        if (invite.expiresAt < new Date()) return res.status(403).json({ error: 'invitation has expired' });
        if (invite.email.toLowerCase() !== req.user.email.toLowerCase()) {
            return res.status(403).json({ error: 'invitation does not belong to your account' });
        }
        const alreadyMember = await prisma.organization.findFirst({
            where: { id: invite.orgId, members: { some: { id: req.user.id } } }
        });
        if (alreadyMember) {
            await prisma.invitation.update({ where: { id: inviteId }, data: { accepted: true } });
            return res.json({ message: 'already a member', slug: invite.org.slug });
        }
        await prisma.$transaction([
            prisma.organization.update({
                where: { id: invite.orgId },
                data: { members: { connect: [{ id: req.user.id }] } }
            }),
            prisma.invitation.update({ where: { id: invite.id }, data: { accepted: true } })
        ]);
        res.json({ message: 'joined successfully', slug: invite.org.slug });
    } catch (err) {
        console.error('[invitation-accept] error:', err);
        res.status(500).json({ error: 'failed to accept invitation' });
    }
});

app.get('/v1/organizations/:slug', requireSupabaseAuth, async (req, res) => {
    const { slug } = req.params;
    if (!/^[a-f0-9]{20}$/.test(slug)) return res.status(400).json({ error: 'invalid slug' });
    try {
        const org = await prisma.organization.findUnique({
            where: { slug },
            include: {
                members: { select: { id: true } },
                _count: { select: { scanHistory: true } }
            }
        });
        if (!org) return res.status(404).json({ error: 'organization not found' });
        const isMember = org.ownerId === req.user.id || org.members.some(m => m.id === req.user.id);
        if (!isMember) return res.status(403).json({ error: 'access denied' });
        res.json({
            id: org.id, name: org.name, slug: org.slug, plan: org.plan, region: org.region,
            isOwner: org.ownerId === req.user.id,
            memberCount: org.members.length,
            scanCount: org._count.scanHistory,
            createdAt: org.createdAt
        });
    } catch (err) {
        console.error('[org-detail] error:', err);
        res.status(500).json({ error: 'failed to fetch organization' });
    }
});

app.get('/v1/organizations/:slug/members', requireSupabaseAuth, async (req, res) => {
    const { slug } = req.params;
    if (!/^[a-f0-9]{20}$/.test(slug)) return res.status(400).json({ error: 'invalid slug' });
    try {
        const org = await prisma.organization.findUnique({
            where: { slug },
            include: {
                members: { select: { id: true, email: true, username: true, createdAt: true } },
                invitations: {
                    where: { accepted: false, expiresAt: { gt: new Date() } },
                    select: { id: true, email: true, role: true, invitedBy: true, createdAt: true }
                }
            }
        });
        if (!org) return res.status(404).json({ error: 'organization not found' });
        const isMember = org.ownerId === req.user.id || org.members.some(m => m.id === req.user.id);
        if (!isMember) return res.status(403).json({ error: 'access denied' });
        res.json({
            members: org.members.map(m => ({
                id: m.id, email: m.email, username: m.username,
                role: m.id === org.ownerId ? 'owner' : 'developer',
                status: 'active', isYou: m.id === req.user.id, joinedAt: m.createdAt
            })),
            pendingInvites: org.invitations.map(inv => ({
                id: inv.id, email: inv.email, role: inv.role, status: 'invited',
                invitedBy: inv.invitedBy, createdAt: inv.createdAt
            })),
            isOwner: org.ownerId === req.user.id
        });
    } catch (err) {
        console.error('[org-members] error:', err);
        res.status(500).json({ error: 'failed to fetch members' });
    }
});

app.delete('/v1/organizations/:slug', requireSupabaseAuth, async (req, res) => {
    const { slug } = req.params;
    if (!/^[a-f0-9]{20}$/.test(slug)) return res.status(400).json({ error: 'invalid slug' });
    try {
        const org = await prisma.organization.findUnique({
            where: { slug },
            select: { id: true, ownerId: true }
        });
        if (!org) return res.status(404).json({ error: 'organization not found' });
        if (org.ownerId !== req.user.id) return res.status(403).json({ error: 'only the owner can delete an organization' });

        await prisma.$transaction(async (tx) => {
            await tx.invitation.deleteMany({ where: { orgId: org.id } });
            await tx.scanHistory.deleteMany({ where: { orgId: org.id } });
            await tx.apiKey.deleteMany({ where: { orgId: org.id } });
            await tx.organization.update({ where: { id: org.id }, data: { members: { set: [] } } });
            await tx.organization.delete({ where: { id: org.id } });
        });

        res.json({ deleted: true });
    } catch (err) {
        console.error('[org-delete] error:', err);
        res.status(500).json({ error: 'failed to delete organization' });
    }
});

process.on('unhandledRejection', (reason) => {
    console.error('[unhandled rejection]', reason instanceof Error ? reason.message : reason);
});

process.on('uncaughtException', (err) => {
    console.error('[uncaught exception]', err.message);
    process.exit(1);
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
    
    app.use((req, res) => {
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`[sentinel-api] server active on port ${PORT}`);
    });

    const { startCryptoMonitor } = require('./services/cryptoMonitor');
    startCryptoMonitor();
}

start().catch((err) => {
    console.error('[startup error]', err);
    process.exit(1);
});
