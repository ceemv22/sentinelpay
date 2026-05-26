const express = require('express');
const crypto = require('crypto');
const prisma = require('../services/db');
const requireSupabaseAuth = require('../middleware/supabaseAuth');

const router = express.Router();
const checkoutJson = express.json({ limit: '10kb' });
const isProduction = process.env.NODE_ENV === 'production';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    if (isProduction) {
        throw new Error('STRIPE_SECRET_KEY must be configured in production.');
    } else {
        console.warn('[stripe] WARNING: STRIPE_SECRET_KEY not set. Stripe features will fail in dev.');
    }
}

const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

function getAppBaseUrl(req) {
    const configuredOrigin = process.env.PUBLIC_APP_URL?.trim();
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
        .filter(origin => origin !== '*');
    const headerOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';

    if (configuredOrigin) return configuredOrigin;
    if (headerOrigin && allowedOrigins.includes(headerOrigin)) return headerOrigin;
    if (allowedOrigins.length > 0) return allowedOrigins[0];
    if (!isProduction) return 'http://localhost:3000';
    throw new Error('PUBLIC_APP_URL or ALLOWED_ORIGINS must be configured for Stripe redirects');
}

router.post('/checkout', checkoutJson, requireSupabaseAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'payment service unavailable', code: 503 });

    const { plan } = req.body;
    if (!plan || typeof plan !== 'string') {
        return res.status(400).json({ error: 'invalid plan', code: 400 });
    }

    const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STARTER;

    try {
        if (!priceId) throw new Error('Stripe price not configured');
        const appBaseUrl = getAppBaseUrl(req);
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            customer_email: req.user.email,
            success_url: `${appBaseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appBaseUrl}/cancel.html`,
            metadata: {
                type: plan.includes('credits') ? 'credits' : 'subscription',
                plan,
                amount: plan.includes('10') ? '10' : (plan.includes('100') ? '100' : '0'),
                userId: req.user.id
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('[stripe]', error);
        res.status(500).json({ error: 'checkout failed', code: 500 });
    }
});

const { encrypt } = require('../services/crypto');

router.post('/webhook', express.raw({ type: 'application/json', limit: '100kb' }), async (req, res) => {
    if (!stripe) return res.status(503).send('payment service unavailable');

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

                if (session.payment_status !== 'paid') {
                    console.log(`[billing] skipping unpaid session: ${session.id}`);
                    return;
                }

                const userId = session.metadata?.userId;
                if (!userId) {
                    console.error(`[billing] CRITICAL: session ${session.id} missing userId metadata`);
                    return;
                }

                const user = await tx.user.findUnique({ where: { id: userId } });
                if (!user) {
                    console.error(`[billing] CRITICAL: user ${userId} not found for session ${session.id}`);
                    return;
                }
                if (session.customer_email && user.email &&
                    session.customer_email.toLowerCase() !== user.email.toLowerCase()) {
                    console.error(`[billing] CRITICAL: email mismatch for session ${session.id} — metadata userId ${userId} (${user.email}) vs session email ${session.customer_email}`);
                    return;
                }

                const PLAN_CREDIT_MAPPING = {
                    'credits_10': 10,
                    'credits_100': 100,
                    'starter': 0,
                    'pro': 0
                };

                const plan = session.metadata?.plan;
                if (session.metadata?.type === 'credits') {
                    const amount = PLAN_CREDIT_MAPPING[plan] || 0;
                    if (amount > 0) {
                        await tx.user.update({
                            where: { id: userId },
                            data: { credits: { increment: amount } }
                        });
                        console.log(`[billing] provisioned ${amount} credits for user ${userId}`);
                    }
                } else {
                    const rawKey = `sp_live_${crypto.randomBytes(24).toString('hex')}`;
                    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

                    await tx.apiKey.create({
                        data: {
                            keyHash,
                            rawKey: encrypt(rawKey),
                            userId,
                            stripeCustomerId: session.customer,
                            plan: session.metadata?.plan || 'starter'
                        }
                    });

                    console.log(`[billing] provisioned api access for user ${userId}`);
                }
            }

            if (event.type === 'customer.subscription.deleted') {
                const subscription = event.data.object;
                await tx.apiKey.updateMany({
                    where: { stripeCustomerId: subscription.customer },
                    data: { active: false }
                });
                console.log(`[billing] revoked access for customer ${subscription.customer}`);
            }
        });
    } catch (err) {
        if (err.code === 'P2002') {
            console.log(`[billing] skipping already processed event: ${event.id}`);
            return res.json({ received: true, duplicate: true });
        }
        console.error('[billing] webhook handling failed', err);
        return res.status(500).json({ error: 'webhook handling failed' });
    }

    res.json({ received: true });
});

module.exports = router;
