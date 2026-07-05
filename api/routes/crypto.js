const express = require('express');
const QRCode = require('qrcode');
const { randomUUID } = require('crypto');
const rateLimit = require('express-rate-limit');
const prisma = require('../services/db');
const requireSupabaseAuth = require('../middleware/supabaseAuth');
const { deriveAddress } = require('../services/cryptoWallet');
const { convertUsdToCrypto } = require('../services/cryptoPricing');

const router = express.Router();
const json = express.json({ limit: '10kb' });

const SUPPORTED = [
    { currency: 'ETH',  network: 'ethereum', label: 'ethereum',      native: true  },
    { currency: 'BNB',  network: 'bsc',       label: 'bsc',           native: true  },
    { currency: 'POL',  network: 'polygon',   label: 'polygon',       native: true  },
    { currency: 'BTC',  network: 'bitcoin',   label: 'bitcoin',       native: true  },
    { currency: 'USDT', network: 'ethereum',  label: 'usdt erc-20',   native: false },
    { currency: 'USDT', network: 'bsc',       label: 'usdt bep-20',   native: false },
    { currency: 'USDT', network: 'polygon',   label: 'usdt polygon',  native: false },
    { currency: 'USDC', network: 'ethereum',  label: 'usdc erc-20',   native: false },
    { currency: 'USDC', network: 'bsc',       label: 'usdc bep-20',   native: false },
    { currency: 'USDC', network: 'polygon',   label: 'usdc polygon',  native: false },
    { currency: 'DAI',  network: 'ethereum',  label: 'dai erc-20',    native: false },
    { currency: 'DAI',  network: 'polygon',   label: 'dai polygon',   native: false },
];

const PLAN_USD = { starter: 99, pro: 399, credits_10: 10, credits_100: 100 };

const cryptoSessionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `crypto_session:${req.user?.id || req.ip}`,
    validate: false,
    message: { error: 'payment session limit exceeded. try again in 1 hour.', code: 429 }
});

const cryptoBatchLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `crypto_batch:${req.user?.id || req.ip}`,
    validate: false,
    message: { error: 'batch session limit exceeded. try again in 1 hour.', code: 429 }
});

router.get('/supported', requireSupabaseAuth, (req, res) => {
    res.json({ configs: SUPPORTED });
});

router.post('/session', json, requireSupabaseAuth, cryptoSessionLimiter, async (req, res) => {
    if (!process.env.CRYPTO_MASTER_SEED) {
        return res.status(503).json({ error: 'crypto payments not configured on this environment' });
    }

    const { plan, currency, network, orgName } = req.body;
    if (!plan || !currency || !network) {
        return res.status(400).json({ error: 'plan, currency and network required' });
    }
    if (!SUPPORTED.find(c => c.currency === currency && c.network === network)) {
        return res.status(400).json({ error: 'unsupported currency/network' });
    }
    const amountUsd = PLAN_USD[plan];
    if (!amountUsd) return res.status(400).json({ error: 'invalid plan' });

    const isSubscription = !plan.startsWith('credits_');
    let trimmedOrgName = null;
    if (isSubscription) {
        if (!orgName || typeof orgName !== 'string') {
            return res.status(400).json({ error: 'organization name required' });
        }
        trimmedOrgName = orgName.trim();
        if (trimmedOrgName.length < 2 || trimmedOrgName.length > 100) {
            return res.status(400).json({ error: 'organization name must be 2-100 characters' });
        }
    }

    try {
        const { amountCrypto, exchangeRate } = await convertUsdToCrypto(amountUsd, currency);

        const counter = await prisma.$transaction(async (tx) => {
            return tx.addressCounter.upsert({
                where: { id: 'singleton' },
                update: { current: { increment: 1 } },
                create: { id: 'singleton', current: 1 }
            });
        });

        const address = deriveAddress(network, counter.current);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const session = await prisma.paymentSession.create({
            data: {
                userId: req.user.id,
                orgId: null,
                orgName: trimmedOrgName,
                plan,
                amountUsd,
                currency,
                network,
                address,
                addressIndex: counter.current,
                amountCrypto,
                exchangeRate,
                expiresAt,
            }
        });

        const qrData = await QRCode.toDataURL(address, { margin: 1, width: 200, color: { dark: '#ffffff', light: '#050505' } });

        res.json({
            id: session.id,
            address: session.address,
            amountCrypto: session.amountCrypto,
            currency: session.currency,
            network: session.network,
            amountUsd: session.amountUsd,
            exchangeRate: session.exchangeRate,
            expiresAt: session.expiresAt,
            status: session.status,
            qrDataUrl: qrData,
        });
    } catch (err) {
        console.error('[crypto-session]', err);
        res.status(500).json({ error: 'failed to create payment session' });
    }
});

router.post('/batch-session', json, requireSupabaseAuth, cryptoBatchLimiter, async (req, res) => {
    if (!process.env.CRYPTO_MASTER_SEED) {
        return res.status(503).json({ error: 'crypto payments not configured on this environment' });
    }

    const { plan, orgName } = req.body;
    if (!plan) return res.status(400).json({ error: 'plan required' });
    const amountUsd = PLAN_USD[plan];
    if (!amountUsd) return res.status(400).json({ error: 'invalid plan' });

    const isSubscription = !plan.startsWith('credits_');
    let trimmedOrgName = null;
    if (isSubscription) {
        if (!orgName || typeof orgName !== 'string') {
            return res.status(400).json({ error: 'organization name required' });
        }
        trimmedOrgName = orgName.trim();
        if (trimmedOrgName.length < 2 || trimmedOrgName.length > 100) {
            return res.status(400).json({ error: 'organization name must be 2-100 characters' });
        }
    }

    try {
        const batchId = randomUUID();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const counter = await prisma.$transaction(async (tx) => {
            return tx.addressCounter.upsert({
                where: { id: 'singleton' },
                update: { current: { increment: SUPPORTED.length } },
                create: { id: 'singleton', current: SUPPORTED.length }
            });
        });
        const baseIndex = counter.current - SUPPORTED.length + 1;

        const rows = [];
        for (let i = 0; i < SUPPORTED.length; i++) {
            const cfg = SUPPORTED[i];
            const { amountCrypto, exchangeRate } = await convertUsdToCrypto(amountUsd, cfg.currency);
            const address = deriveAddress(cfg.network, baseIndex + i);
            rows.push({
                userId: req.user.id,
                orgId: null,
                orgName: trimmedOrgName,
                plan,
                amountUsd,
                currency: cfg.currency,
                network: cfg.network,
                address,
                addressIndex: baseIndex + i,
                amountCrypto,
                exchangeRate,
                expiresAt,
                batchId,
            });
        }

        await prisma.paymentSession.createMany({ data: rows });

        const created = await prisma.paymentSession.findMany({
            where: { batchId },
            select: { id: true, currency: true, network: true, address: true, amountCrypto: true, amountUsd: true, exchangeRate: true, expiresAt: true, status: true }
        });

        const sessions = {};
        for (const s of created) {
            const qrData = await QRCode.toDataURL(s.address, { margin: 1, width: 200, color: { dark: '#ffffff', light: '#050505' } });
            sessions[s.currency + ':' + s.network] = { ...s, batchId, qrDataUrl: qrData };
        }

        res.json({ batchId, expiresAt, sessions });
    } catch (err) {
        console.error('[crypto-batch-session]', err);
        res.status(500).json({ error: 'failed to create payment session' });
    }
});

router.get('/session/:id', requireSupabaseAuth, async (req, res) => {
    try {
        const session = await prisma.paymentSession.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, userId: true, plan: true, status: true,
                txHash: true, txBroadcastAt: true, amountCrypto: true,
                amountReceived: true, currency: true, network: true,
                address: true, amountUsd: true, exchangeRate: true,
                refundStatus: true, expiresAt: true, confirmedAt: true, createdAt: true
            }
        });
        if (!session) return res.status(404).json({ error: 'session not found' });
        if (session.userId !== req.user.id) return res.status(403).json({ error: 'access denied' });
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: 'failed to fetch session' });
    }
});

router.get('/sessions', requireSupabaseAuth, async (req, res) => {
    try {
        const sessions = await prisma.paymentSession.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true, plan: true, status: true, currency: true, network: true,
                amountUsd: true, amountCrypto: true, amountReceived: true,
                txHash: true, txBroadcastAt: true, refundStatus: true,
                batchId: true, expiresAt: true, confirmedAt: true, createdAt: true
            }
        });
        res.json(sessions);
    } catch (err) {
        console.error('[payment-sessions]', err);
        res.status(500).json({ error: 'failed to fetch payment sessions' });
    }
});

const BTC_ADDR_RE = /^(bc1[ac-hj-np-z02-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

router.post('/session/:id/refund', json, requireSupabaseAuth, async (req, res) => {
    const { refundAddress } = req.body;
    if (!refundAddress || typeof refundAddress !== 'string' || refundAddress.length > 100) {
        return res.status(400).json({ error: 'refund address required' });
    }

    const isEvm = EVM_ADDR_RE.test(refundAddress);
    const isBtc = BTC_ADDR_RE.test(refundAddress);
    if (!isEvm && !isBtc) {
        return res.status(400).json({ error: 'invalid refund address format' });
    }

    try {
        const session = await prisma.paymentSession.findUnique({
            where: { id: req.params.id },
            select: { id: true, userId: true, status: true, refundStatus: true, network: true, amountReceived: true }
        });
        if (!session) return res.status(404).json({ error: 'session not found' });
        if (session.userId !== req.user.id) return res.status(403).json({ error: 'access denied' });
        if (!['expired', 'grace'].includes(session.status)) {
            return res.status(400).json({ error: 'refund only available for expired or grace sessions' });
        }
        if (session.refundStatus !== 'none') {
            return res.status(409).json({ error: 'refund already requested' });
        }
        if (!session.amountReceived || session.amountReceived <= 0) {
            return res.status(400).json({ error: 'no funds detected on this session address' });
        }

        if (session.network === 'bitcoin' && !isBtc) {
            return res.status(400).json({ error: 'bitcoin session requires a bitcoin refund address' });
        }
        if (session.network !== 'bitcoin' && !isEvm) {
            return res.status(400).json({ error: 'evm session requires an ethereum-compatible refund address' });
        }

        await prisma.paymentSession.update({
            where: { id: session.id },
            data: { refundAddress, refundStatus: 'requested' }
        });

        res.json({ message: 'refund request submitted', refundStatus: 'requested' });
    } catch (err) {
        console.error('[refund-request]', err);
        res.status(500).json({ error: 'failed to submit refund request' });
    }
});

module.exports = router;
