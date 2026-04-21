const express = require('express');
const crypto = require('crypto');
const prisma = require('../services/db');
const requireSupabaseAuth = require('../middleware/supabaseAuth');

const router = express.Router();
const checkoutJson = express.json({ limit: '10kb' });
const isProduction = process.env.NODE_ENV === 'production';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (isProduction && !stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY must be configured in production.');
}

const stripe = require('stripe')(stripeSecretKey || 'sk_test_dummy_key_replace_me');

function getAppBaseUrl(req) {
    const configuredOrigin = process.env.PUBLIC_APP_URL?.trim();
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
        .filter(origin => origin !== '*');
    const headerOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';

    if (configuredOrigin) {
        return configuredOrigin;
    }
    if (headerOrigin && allowedOrigins.includes(headerOrigin)) {
        return headerOrigin;
    }
    if (allowedOrigins.length > 0) {
        return allowedOrigins[0];
    }
    if (process.env.NODE_ENV !== 'production') {
        return 'http://localhost:3000';
    }
    throw new Error('PUBLIC_APP_URL or ALLOWED_ORIGINS must be configured for Stripe redirects');
}

router.post('/checkout', checkoutJson, requireSupabaseAuth, async (req, res) => {
    const { plan } = req.body; // 'starter' or 'pro'
    const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STARTER;

    try {
        if (!priceId) {
            throw new Error('Stripe price not configured');
        }
        const appBaseUrl = getAppBaseUrl(req);
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            customer_email: req.user.email,
            success_url: `${appBaseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appBaseUrl}/cancel.html`,
            metadata: {
                plan,
                userId: req.user.id
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('[stripe]', error);
        res.status(500).json({ error: 'checkout failed', code: 500 });
    }
});

// Webhook to provision API Keys
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('[stripe webhook signature error]', err.message);
        return res.status(400).send('Webhook verification failed');
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.processedEvent.create({
                data: { id: event.id, type: event.type }
            });

            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;
                const userId = session.metadata?.userId;
                if (!userId) {
                    throw new Error('Stripe session missing userId metadata');
                }

                const rawKey = 'sp_' + crypto.randomBytes(32).toString('hex');
                const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

                await tx.apiKey.create({
                    data: {
                        keyHash,
                        userId,
                        stripeCustomerId: session.customer,
                        plan: session.metadata?.plan || 'starter'
                    }
                });

                console.log(`[billing] Successfully provisioned API access for user ${userId}`);
            }

            if (event.type === 'customer.subscription.deleted') {
                const subscription = event.data.object;
                await tx.apiKey.updateMany({
                    where: { stripeCustomerId: subscription.customer },
                    data: { active: false }
                });
                console.log(`[billing] Revoked access for customer ${subscription.customer}`);
            }
        });
    } catch (err) {
        if (err.code === 'P2002') {
            console.log(`[billing] Skipping already processed event: ${event.id}`);
            return res.json({ received: true, duplicate: true });
        }
        console.error('[billing] Webhook handling failed', err);
        return res.status(500).json({ error: 'webhook handling failed' });
    }

    res.json({ received: true });
});

module.exports = router;
