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

        // Store this rawKey securely via email/dashboard in real-world scenario
        console.log(`[billing] Provisioned new API KEY for customer ${session.customer}`);
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        await prisma.apiKey.updateMany({
            where: { stripeCustomerId: subscription.customer },
            data: { active: false }
        });
        console.log(`[billing] Revoked access for customer ${subscription.customer}`);
    }

    res.json({ received: true });
});

module.exports = router;
