const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/v1/score', (req, res) => {
    const { wallet } = req.body;

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({
            error: 'invalid wallet address format. must be 0x followed by 40 hex characters',
            code: 400
        });
    }

    const normalizedWallet = wallet.toLowerCase();

    let score, category, flags;

    if (normalizedWallet === '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a') {
        score = 88;
        category = 'high';
        flags = ['mixer_interaction', 'new_wallet', 'high_velocity'];
    } else if (normalizedWallet === '0x742d35cc6634c0532925a3b844bc9e695d487da2') {
        score = 12;
        category = 'low';
        flags = [];
    } else {
        score = 42;
        category = 'medium';
        flags = ['new_wallet'];
    }

    const response = {
        wallet: normalizedWallet,
        score,
        category,
        flags,
        timestamp: new Date().toISOString()
    };

    res.json(response);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.use((req, res) => {
    res.status(404).json({
        error: 'not found',
        code: 404
    });
});

app.listen(PORT, () => {
    console.log(`sentinelpay API running on http://localhost:${PORT}`);
    console.log(`test endpoint: POST http://localhost:${PORT}/v1/score`);
});