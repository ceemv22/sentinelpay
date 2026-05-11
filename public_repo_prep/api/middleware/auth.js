const crypto = require('crypto');
const prisma = require('../services/db');

async function requireApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return res.status(401).json({
            error: 'missing x-api-key header',
            code: 401
        });
    }

    try {
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        const keyRecord = await prisma.apiKey.findUnique({
            where: { keyHash }
        });

        if (!keyRecord || !keyRecord.active) {
            return res.status(401).json({
                error: 'invalid or disabled api key',
                code: 401
            });
        }

        req.apiKey = keyRecord;
        next();
    } catch (err) {
        console.error('[auth error]', err);
        return res.status(500).json({ error: 'authentication error', code: 500 });
    }
}

module.exports = requireApiKey;
