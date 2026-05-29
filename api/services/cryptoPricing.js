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

async function refreshPrices() {
    const ids = Object.values(COINGECKO_IDS).join(',');
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: { ids, vs_currencies: 'usd' },
        timeout: 8000,
        headers: { 'Accept': 'application/json' }
    });
    const out = {};
    for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
        if (res.data[id]?.usd) out[sym] = res.data[id].usd;
    }
    return out;
}

async function convertUsdToCrypto(amountUsd, currency) {
    if (Date.now() > cacheTtl || !priceCache[currency]) {
        priceCache = await refreshPrices();
        cacheTtl = Date.now() + 5 * 60 * 1000;
    }
    const rate = priceCache[currency];
    if (!rate) throw new Error(`price unavailable for ${currency}`);
    const decimals = ['SHIB'].includes(currency) ? 0 : 8;
    const amountCrypto = (amountUsd / rate).toFixed(decimals);
    return { amountCrypto, exchangeRate: rate };
}

module.exports = { convertUsdToCrypto };
