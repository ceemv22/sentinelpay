const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
    },
    message: {
        error: 'request limit exceeded. try again in 15 minutes',
        code: 429
    }
});

app.use('/v1/score', limiter);

app.post('/v1/score', (req, res) => {
    const { wallet } = req.body;

    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({
            error: 'invalid wallet address format. must be 0x followed by 40 hex characters',
            code: 400
        });
    }

    const apiKey = process.env.ETHERSCAN_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'ETHERSCAN_API_KEY not configured',
            code: 500
        });
    }

    const scriptPath = path.join(__dirname, '..', 'engine', 'score.py');

    const python = spawn('python3', [scriptPath, wallet, apiKey]);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
        output += data.toString();
    });

    python.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('[python stderr]', data.toString());
    });

    python.on('close', (code) => {
        console.log(`[python] exited with code ${code}`);
        if (errorOutput) {
            console.error('[python debug]', errorOutput);
        }

        try {
            const result = JSON.parse(output.trim());

            if (result.error) {
                return res.status(500).json({
                    error: result.error,
                    code: 500
                });
            }

            res.json({
                wallet: wallet.toLowerCase(),
                score: result.score,
                category: result.category,
                flags: result.flags,
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            console.error('[parse error]', e.message, '| raw output:', output);
            res.status(500).json({
                error: 'scoring engine returned invalid response',
                code: 500
            });
        }
    });

    python.on('error', (err) => {
        console.error('[spawn error]', err);
        res.status(500).json({
            error: 'failed to start scoring engine. is python installed?',
            code: 500
        });
    });
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