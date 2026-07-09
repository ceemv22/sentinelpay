const axios = require('axios');

const COINGECKO_IDS = {
    ETH:  'ethereum',
    BTC:  'bitcoin',
    BNB:  'binancecoin',
    POL:  'polygon-ecosystem-token',
    USDT: 'tether',
    USDC: 'usd-coin',
    DAI:  'dai',
};

let priceCache = {};
let cacheTtl = 0;
let cacheSetAt = 0;
const MAX_STALE_MS = 60 * 60 * 1000;

async function refreshPrices() {
    const ids = Object.values(COINGECKO_IDS).join(',');
    const headers = { 'Accept': 'application/json' };
    if (process.env.COINGECKO_API_KEY) {
        headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
    }

    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: { ids, vs_currencies: 'usd' },
                timeout: 8000,
                headers
            });
            const out = {};
            for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
                if (res.data[id]?.usd) out[sym] = res.data[id].usd;
            }
            return out;
        } catch (err) {
            lastErr = err;
            if (err.response?.status === 429 && attempt < 2) {
                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                continue;
            }
            break;
        }
    }
    throw lastErr;
}

async function convertUsdToCrypto(amountUsd, currency) {
    if (Date.now() > cacheTtl || !priceCache[currency]) {
        try {
            priceCache = await refreshPrices();
            cacheTtl = Date.now() + 10 * 60 * 1000;
            cacheSetAt = Date.now();
        } catch (err) {
            const staleAge = Date.now() - cacheSetAt;
            if (priceCache[currency] && staleAge < MAX_STALE_MS) {
                console.warn('[crypto-pricing] using stale cache after fetch failure:', err.message);
            } else {
                throw new Error(`price unavailable for ${currency}`);
            }
        }
    }
    const rate = priceCache[currency];
    if (!rate || typeof rate !== 'number' || !isFinite(rate) || rate <= 0) {
        throw new Error(`price unavailable for ${currency}`);
    }
    const amountCrypto = (amountUsd / rate).toFixed(8);
    return { amountCrypto, exchangeRate: rate };
}

module.exports = { convertUsdToCrypto };
