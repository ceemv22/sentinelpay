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

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['POST', 'GET'],
}));
app.use(express.json({ limit: '10kb' }));

// Serve the PLG Frontend
app.use(express.static(path.join(__dirname, 'public')));

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

// B2B API Limiter (used internally if needed, but primarily auth is used)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('b2b:'),
    message: { error: 'request limit exceeded. try again in 15 minutes.', code: 429 }
});

// Public IP Rate Limiter (very strict for PLG frontend)
const publicLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per IP
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore('plg:'),
    message: { error: 'public rate limit exceeded. max 5 scans per hour.', code: 429 }
});

// Helper for audit logging
async function logAudit(req, wallet, result, apiKeyId = null) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
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
app.post('/v1/score', requireApiKey, async (req, res) => {
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
        res.status(err.status || 500).json({ error: err.error || 'internal error', code: err.code || 500 });
    }
});

// PLG Public Endpoint (Rate Limited by IP)
app.post('/v1/public/score', publicLimiter, async (req, res) => {
    const { wallet } = req.body;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'invalid wallet address format', code: 400 });
    }

    try {
        const result = await runScoringEngine(wallet);
        await logAudit(req, wallet, result, null); // null API key ID for public

        res.json({
            wallet: wallet.toLowerCase(),
            score: result.score,
            category: result.category,
            flags: result.flags,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.error || 'internal error', code: err.code || 500 });
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