const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_replace_me');
const crypto = require('crypto');
const prisma = require('../services/db');

const router = express.Router();

router.post('/checkout', async (req, res) => {
    const { plan } = req.body; // 'starter' or 'pro'
    const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_STARTER;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/cancel.html`,
            metadata: { plan }
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
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // OWASP S-Tier Hardening: Idempotency Protection
    // Ensures each Stripe event is processed EXACTLY once, preventing replay attacks or duplicate provisioning
    try {
        const alreadyProcessed = await prisma.processedEvent.findUnique({
            where: { id: event.id }
        });
        if (alreadyProcessed) {
            console.log(`[billing] Skipping already processed event: ${event.id}`);
            return res.json({ received: true, duplicate: true });
        }
    } catch (err) {
        console.error('[billing] Idempotency check failed', err);
        // We continue defensively, but better to log
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Generate new API key
        const rawKey = 'sp_' + crypto.randomBytes(32).toString('hex');
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        await prisma.apiKey.create({
            data: {
                keyHash,
                stripeCustomerId: session.customer,
                plan: session.metadata.plan || 'starter'
            }
        });

        // Provision API key
        console.log(`[billing] Successfully provisioned API access for customer ${session.customer}`);
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        await prisma.apiKey.updateMany({
            where: { stripeCustomerId: subscription.customer },
            data: { active: false }
        });
        console.log(`[billing] Revoked access for customer ${subscription.customer}`);
    }

    // Finalize: Track this event as processed
    try {
        await prisma.processedEvent.create({
            data: { id: event.id, type: event.type }
        });
    } catch (err) {
        console.error('[billing] Failed to log processed event', err);
    }

    res.json({ received: true });
});

module.exports = router;
