const express = require('express');
const QRCode = require('qrcode');
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
    { currency: 'SHIB', network: 'ethereum',  label: 'shib erc-20',   native: false },
];

const PLAN_USD = { starter: 99, pro: 399, credits_10: 10, credits_100: 100 };

router.get('/supported', requireSupabaseAuth, (req, res) => {
    res.json({ configs: SUPPORTED });
});

router.post('/session', json, requireSupabaseAuth, async (req, res) => {
    const { plan, currency, network, orgId } = req.body;
    if (!plan || !currency || !network) {
        return res.status(400).json({ error: 'plan, currency and network required' });
    }
    if (!SUPPORTED.find(c => c.currency === currency && c.network === network)) {
        return res.status(400).json({ error: 'unsupported currency/network' });
    }
    const amountUsd = PLAN_USD[plan];
    if (!amountUsd) return res.status(400).json({ error: 'invalid plan' });

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
                orgId: orgId || null,
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

        const qrData = await QRCode.toDataURL(address, { margin: 1, width: 200, color: { dark: '#00f0ff', light: '#050505' } });

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
        res.status(500).json({ error: 'failed to create payment session', detail: err.message });
    }
});

router.get('/session/:id', requireSupabaseAuth, async (req, res) => {
    try {
        const session = await prisma.paymentSession.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, userId: true, status: true, txHash: true,
                amountCrypto: true, currency: true, network: true,
                address: true, amountUsd: true, expiresAt: true, confirmedAt: true
            }
        });
        if (!session) return res.status(404).json({ error: 'session not found' });
        if (session.userId !== req.user.id) return res.status(403).json({ error: 'access denied' });
        res.json(session);
    } catch (err) {
        res.status(500).json({ error: 'failed to fetch session' });
    }
});

module.exports = router;
