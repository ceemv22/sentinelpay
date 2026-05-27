const axios = require('axios');
const crypto = require('crypto');
const prisma = require('./db');
const { encrypt } = require('./crypto');

const TOKEN_CONTRACTS = {
    ethereum: {
        USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    },
    bsc: {
        USDT: '0x55d398326f99059fF775485246999027B3197955',
        USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    },
    polygon: {
        USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    },
};

const NATIVE_BY_NETWORK = { ethereum: 'ETH', bsc: 'BNB', polygon: 'POL', bitcoin: 'BTC' };

function alchemyUrl(network) {
    const keys = { ethereum: 'ALCHEMY_ETH_KEY', bsc: 'ALCHEMY_BNB_KEY', polygon: 'ALCHEMY_POL_KEY' };
    const key = process.env[keys[network]];
    if (!key) return null;
    const hosts = { ethereum: 'eth-mainnet', bsc: 'bnb-mainnet', polygon: 'polygon-mainnet' };
    return `https://${hosts[network]}.g.alchemy.com/v2/${key}`;
}

async function alchemyTransfers(url, toAddress, contractAddresses, category) {
    const params = { toAddress, category, withMetadata: false, maxCount: '0xa' };
    if (contractAddresses) params.contractAddresses = contractAddresses;
    const res = await axios.post(url, {
        jsonrpc: '2.0', id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [params]
    }, { timeout: 10000 });
    return res.data?.result?.transfers || [];
}

async function checkEvmSession(session) {
    const url = alchemyUrl(session.network);
    if (!url) return null;
    const expected = parseFloat(session.amountCrypto) * 0.99;
    const isNative = NATIVE_BY_NETWORK[session.network] === session.currency;

    if (isNative) {
        const transfers = await alchemyTransfers(url, session.address, null, ['external']);
        for (const t of transfers) {
            if ((t.value || 0) >= expected) return t.hash;
        }
    } else {
        const contract = TOKEN_CONTRACTS[session.network]?.[session.currency];
        if (!contract) return null;
        const transfers = await alchemyTransfers(url, session.address, [contract], ['erc20']);
        for (const t of transfers) {
            if ((t.value || 0) >= expected) return t.hash;
        }
    }
    return null;
}

async function checkBtcSession(session) {
    const token = process.env.BLOCKCYPHER_TOKEN;
    const params = token ? { token } : {};
    const res = await axios.get(
        `https://api.blockcypher.com/v1/btc/main/addrs/${session.address}`,
        { params, timeout: 10000 }
    );
    const totalReceived = (res.data.total_received || 0) / 1e8;
    if (totalReceived >= parseFloat(session.amountCrypto) * 0.99) {
        const refs = [...(res.data.txrefs || []), ...(res.data.unconfirmed_txrefs || [])];
        return refs[0]?.tx_hash || 'confirmed';
    }
    return null;
}

async function provisionPayment(session, txHash) {
    await prisma.$transaction(async (tx) => {
        await tx.paymentSession.update({
            where: { id: session.id },
            data: { status: 'confirmed', txHash, confirmedAt: new Date() }
        });

        const CREDIT_MAP = { credits_10: 10, credits_100: 100 };
        if (session.plan.startsWith('credits_')) {
            const amount = CREDIT_MAP[session.plan] || 0;
            if (amount > 0) {
                await tx.user.update({
                    where: { id: session.userId },
                    data: { credits: { increment: amount } }
                });
            }
        } else {
            const rawKey = `sp_live_${crypto.randomBytes(24).toString('hex')}`;
            const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
            await tx.apiKey.create({
                data: {
                    keyHash,
                    rawKey: encrypt(rawKey),
                    userId: session.userId,
                    orgId: session.orgId || null,
                    plan: session.plan
                }
            });
        }
    });
    console.log(`[crypto-monitor] session ${session.id} confirmed via ${txHash}`);
}

async function checkPendingPayments() {
    let pending;
    try {
        pending = await prisma.paymentSession.findMany({ where: { status: 'pending' } });
    } catch (err) {
        console.error('[crypto-monitor] db error:', err.message);
        return;
    }

    const now = new Date();
    for (const session of pending) {
        if (new Date(session.expiresAt) < now) {
            await prisma.paymentSession.update({ where: { id: session.id }, data: { status: 'expired' } });
            continue;
        }
        try {
            let txHash = null;
            if (session.network === 'bitcoin') {
                txHash = await checkBtcSession(session);
            } else {
                txHash = await checkEvmSession(session);
            }
            if (txHash) await provisionPayment(session, txHash);
        } catch (err) {
            console.error(`[crypto-monitor] check error for ${session.id}:`, err.message);
        }
    }
}

function startCryptoMonitor() {
    if (!process.env.CRYPTO_MASTER_SEED) {
        console.warn('[crypto-monitor] CRYPTO_MASTER_SEED not set, monitoring disabled');
        return;
    }
    console.log('[crypto-monitor] started (20s interval)');
    setInterval(checkPendingPayments, 20_000);
}

module.exports = { startCryptoMonitor };
