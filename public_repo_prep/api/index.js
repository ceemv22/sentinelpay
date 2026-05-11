/**
 * sentinelpay public core v2.0
 * demonstration of b2b api architecture, security middlewares, and high-performance routing.
 * note: proprietary heuristics engine logic is obfuscated/mocked in this public version.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const hpp = require('hpp');
require('dotenv').config();

const { runScoringEngine } = require('./services/scorer');
const requireApiKey = require('./middleware/auth');
const requireSupabaseAuth = require('./middleware/supabaseAuth');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// s-tier security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "https://*.supabase.co"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "frame-ancestors": ["'none'"],
            "object-src": ["'none'"]
        }
    }
}));

app.use(hpp()); 
app.use(express.json({ limit: '10kb' }));
app.use(cors());

// serve dashboard assets
app.use(express.static(path.join(__dirname, '../dashboard'), { extensions: ['html'] }));

/**
 * b2b risk scoring endpoint
 * requires valid api key via x-api-key header.
 */
app.post('/v1/score', requireApiKey, async (req, res) => {
    const { wallet } = req.body;
    
    // validation
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'invalid wallet address format', code: 400 });
    }

    try {
        // proprietary scoring engine call
        const result = await runScoringEngine(wallet);
        
        res.json({
            wallet: wallet.toLowerCase(),
            score: result.score,
            category: result.category,
            flags: result.flags,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('[api error]', err);
        res.status(500).json({ error: 'failed to process risk score' });
    }
});

/**
 * user profile & history
 * protected by supabase session auth.
 */
app.get('/v1/user/profile', requireSupabaseAuth, async (req, res) => {
    // demo logic for public showcase
    res.json({
        id: req.user.id,
        email: req.user.email,
        credits: 100,
        status: 'active'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[sentinel-public-core] active on port ${PORT}`);
});
