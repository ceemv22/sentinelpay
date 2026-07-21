const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

function resolveTrustProxySetting(value) {
    if (value === undefined || value === null || value === '') return undefined;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    if (/^\d+$/.test(normalized)) return Number(normalized);
    return value;
}

const trustProxySetting = resolveTrustProxySetting(process.env.TRUST_PROXY);
app.set('trust proxy', trustProxySetting === undefined ? 1 : trustProxySetting);

// Prefer Cloudflare's connecting IP when present; otherwise Express's trust-proxy req.ip.
app.use((req, res, next) => {
    const cfIp = req.headers['cf-connecting-ip'];
    req.realIp = (typeof cfIp === 'string' && cfIp.length > 0) ? cfIp : req.ip;
    next();
});

app.use(hpp());
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            'default-src': ["'self'"],
            'script-src': [
                "'self'",
                "'unsafe-inline'",
                'https://widget.intercom.io',
                'https://js.intercomcdn.com',
                'https://*.intercomcdn.com',
                'https://*.intercom.io',
                'blob:'
            ],
            'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://fonts.intercomcdn.com'],
            'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://fonts.intercomcdn.com'],
            'img-src': [
                "'self'",
                'data:',
                'https://*.intercomcdn.com',
                'https://*.intercom.io',
                'https://*.intercomassets.com'
            ],
            'connect-src': [
                "'self'",
                'https://api-iam.intercom.io',
                'https://*.intercom.io',
                'https://uploads.intercomcdn.com',
                'https://uploads.intercomusercontent.com',
                'https://*.intercomcdn.com',
                'wss://nexus-websocket-a.intercom.io',
                'wss://nexus-websocket-b.intercom.io',
                'wss://*.intercom.io',
                'wss://*.intercom-messenger.com'
            ],
            'frame-src': ["'self'", 'https://intercom-sheets.com', 'https://*.intercom.io', 'blob:'],
            'base-uri': ["'self'"],
            'form-action': ["'self'"],
            'frame-ancestors': ["'none'"],
            'object-src': ["'none'"],
            'upgrade-insecure-requests': [],
            'worker-src': ["'self'", 'blob:']
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }
}));

app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'xr-spatial-tracking=(), camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), ambient-light-sensor=(), accelerometer=(), gyroscope=(), magnetometer=(), display-capture=()');
    next();
});

app.use(cors({
    origin: (origin, callback) => {
        if (allowedOrigins.includes('*')) {
            if (isProduction) return callback(new Error('Wildcard CORS disallowed in production.'));
            return callback(null, true);
        }
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0) {
            return callback(isProduction ? new Error('ALLOWED_ORIGINS must be configured in production.') : null, !isProduction);
        }
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['POST', 'GET']
}));

app.use(express.json({ limit: '10kb' }));

// Serve the static marketing site (/, /privacy, /tos, assets).
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Rate-limit the demo form: 5 submissions / hour / IP (in-memory store).
const demoRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `demo_request:${req.realIp}`,
    message: { error: 'too many requests, please try again later' }
});

app.post('/v1/demo-request', demoRequestLimiter, async (req, res) => {
    try {
        const b = req.body || {};
        const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
        const firstName = clean(b.firstName, 80);
        const lastName = clean(b.lastName, 80);
        const jobTitle = clean(b.jobTitle, 120);
        const email = clean(b.email, 160);
        const company = clean(b.company, 120);
        const website = clean(b.website, 160);
        const industry = clean(b.industry, 80);
        const country = clean(b.country || b.region, 80);
        const size = clean(b.size, 40);
        const volume = clean(b.volume, 40);
        const solutions = Array.isArray(b.solutions) ? b.solutions.map((s) => clean(s, 60)).filter(Boolean).slice(0, 12).join(', ') : '';
        const message = clean(b.message, 2000);
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const nameRe = /^[a-zA-ZÀ-ɏ'’.\- ]{2,}$/;

        if (!nameRe.test(firstName) || !nameRe.test(lastName) || jobTitle.length < 2 ||
            !emailRe.test(email) || !company || b.consent !== true) {
            return res.status(400).json({ error: 'invalid submission' });
        }

        // website domain must match the work email domain (subdomains either way are fine)
        if (website) {
            const host = website.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '').toLowerCase();
            const emailDomain = email.split('@').pop().toLowerCase();
            const matches = host === emailDomain ||
                host.endsWith('.' + emailDomain) ||
                emailDomain.endsWith('.' + host);
            if (!matches) {
                return res.status(400).json({ error: 'website domain must match your work email domain' });
            }
        }

        const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
        const row = (k, v) => v ? `<tr><td style="padding:4px 12px 4px 0;color:#888;">${k}</td><td style="padding:4px 0;color:#111;">${esc(v)}</td></tr>` : '';

        if (process.env.RESEND_API_KEY) {
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
                from: 'sentinelpay <noreply@sentinelpay.org>',
                to: 'support@sentinelpay.org',
                replyTo: email,
                subject: `new demo request — ${firstName} ${lastName}${company ? ' @ ' + company : ''}`,
                html: `<div style="font-family:Arial,sans-serif;font-size:14px;">
                    <h2 style="margin:0 0 12px;">new demo request</h2>
                    <table style="border-collapse:collapse;">
                        ${row('name', firstName + ' ' + lastName)}
                        ${row('job title', jobTitle)}
                        ${row('email', email)}
                        ${row('company', company)}
                        ${row('website', website)}
                        ${row('industry', industry)}
                        ${row('country', country)}
                        ${row('company size', size)}
                        ${row('wallets/txns per year', volume)}
                        ${row('solutions', solutions)}
                        ${row('message', message)}
                    </table>
                </div>`
            });
        } else {
            console.log('[demo-request]', { firstName, lastName, jobTitle, email, company, website, industry, country, size, volume, solutions });
        }

        res.json({ ok: true });
    } catch (err) {
        console.error('[demo-request error]', err.message);
        res.status(500).json({ error: 'failed to submit' });
    }
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'request body too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid request body' });
    if (err.message === 'Not allowed by CORS') return res.status(403).json({ error: 'cors policy violation' });
    console.error('[unhandled error]', err.message || err);
    if (!res.headersSent) return res.status(500).json({ error: 'internal server error' });
    next(err);
});

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

process.on('unhandledRejection', (reason) => {
    console.error('[unhandled rejection]', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
    console.error('[uncaught exception]', err.message);
    process.exit(1);
});

app.listen(PORT, () => {
    console.log(`[sentinelpay-web] server active on port ${PORT}`);
});
