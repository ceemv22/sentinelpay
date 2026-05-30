const axios = require('axios');
const crypto = require('crypto');
const prisma = require('./db');
const { encrypt } = require('./crypto');

const TOKEN_CONTRACTS = {
    ethereum: {
        USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        DAI:  '0x6B175474E89094C44Da98b954EedeAC495271d0F',
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
const SLIPPAGE = 0.98;
const GRACE_WINDOW_MS = 6 * 60 * 60 * 1000;
const CLEANUP_EMPTY_RETENTION_MS = 72 * 60 * 60 * 1000;
const CLEANUP_FUNDED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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

    const expected = parseFloat(session.amountCrypto) * SLIPPAGE;
    const isNative = NATIVE_BY_NETWORK[session.network] === session.currency;

    let transfers;
    if (isNative) {
        transfers = await alchemyTransfers(url, session.address, null, ['external']);
    } else {
        const contract = TOKEN_CONTRACTS[session.network]?.[session.currency];
        if (!contract) return null;
        transfers = await alchemyTransfers(url, session.address, [contract], ['erc20']);
    }

    const totalReceived = transfers.reduce((sum, t) => sum + (t.value || 0), 0);
    if (totalReceived >= expected) {
        return { hash: transfers[0]?.hash || 'confirmed', amountReceived: totalReceived, broadcastAt: null };
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

    const expected = parseFloat(session.amountCrypto) * SLIPPAGE;
    const totalConfirmed = (res.data.total_received || 0) / 1e8;

    if (totalConfirmed >= expected) {
        const refs = res.data.txrefs || [];
        return { hash: refs[0]?.tx_hash || 'confirmed', amountReceived: totalConfirmed, broadcastAt: null };
    }

    const unconfirmed = res.data.unconfirmed_txrefs || [];
    if (unconfirmed.length > 0) {
        const broadcastAt = unconfirmed[0]?.received ? new Date(unconfirmed[0].received) : new Date();
        const unconfirmedAmount = (res.data.unconfirmed_balance || 0) / 1e8;
        return { hash: null, amountReceived: unconfirmedAmount, broadcastAt };
    }

    return null;
}

async function provisionPayment(session, txHash, amountReceived) {
    await prisma.$transaction(async (tx) => {
        const updated = await tx.paymentSession.updateMany({
            where: { id: session.id, status: { in: ['pending', 'grace'] } },
            data: { status: 'confirmed', txHash, confirmedAt: new Date(), amountReceived: amountReceived || null }
        });
        if (updated.count === 0) return;

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
            const orgDisplayName = (session.orgName && session.orgName.trim().length >= 2)
                ? session.orgName.trim()
                : `org-${session.id.substring(0, 8)}`;
            const slug = crypto.randomBytes(10).toString('hex');

            const org = await tx.organization.create({
                data: {
                    name: orgDisplayName,
                    slug,
                    plan: session.plan,
                    region: 'americas',
                    ownerId: session.userId,
                    members: { connect: [{ id: session.userId }] }
                }
            });

            await tx.paymentSession.update({
                where: { id: session.id },
                data: { orgId: org.id }
            });

            const rawKey = `sp_live_${crypto.randomBytes(24).toString('hex')}`;
            const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
            await tx.apiKey.create({
                data: {
                    keyHash,
                    rawKey: encrypt(rawKey),
                    userId: session.userId,
                    orgId: org.id,
                    plan: session.plan
                }
            });
        }
    });
    console.log(`[crypto-monitor] session ${session.id} confirmed via ${txHash}`);
}

async function cleanupExpiredSessions() {
    const emptyCutoff = new Date(Date.now() - CLEANUP_EMPTY_RETENTION_MS);
    const fundedCutoff = new Date(Date.now() - CLEANUP_FUNDED_RETENTION_MS);
    try {
        const empty = await prisma.paymentSession.deleteMany({
            where: {
                status: 'expired',
                expiresAt: { lt: emptyCutoff },
                amountReceived: null,
                refundStatus: 'none'
            }
        });
        const funded = await prisma.paymentSession.deleteMany({
            where: {
                status: 'expired',
                expiresAt: { lt: fundedCutoff },
                refundStatus: 'processed'
            }
        });
        const deleted = empty.count + funded.count;
        if (deleted > 0) {
            console.log(`[crypto-monitor] cleanup: ${empty.count} empty (>72h), ${funded.count} resolved funded (>30d)`);
        }
    } catch (err) {
        console.error('[crypto-monitor] cleanup error:', err.message);
    }
}

async function checkPendingPayments() {
    let sessions;
    try {
        sessions = await prisma.paymentSession.findMany({
            where: { status: { in: ['pending', 'grace'] } }
        });
    } catch (err) {
        console.error('[crypto-monitor] db error:', err.message);
        return;
    }

    const now = new Date();
    for (const session of sessions) {
        const expiresAt = new Date(session.expiresAt);
        const graceDeadline = new Date(expiresAt.getTime() + GRACE_WINDOW_MS);

        if (session.status === 'grace' && now > graceDeadline) {
            await prisma.paymentSession.update({
                where: { id: session.id },
                data: { status: 'expired' }
            });
            console.log(`[crypto-monitor] session ${session.id} grace window elapsed`);
            continue;
        }

        if (session.status === 'pending' && expiresAt < now) {
            await prisma.paymentSession.update({
                where: { id: session.id },
                data: { status: 'expired' }
            });
            continue;
        }

        try {
            let result = null;
            if (session.network === 'bitcoin') {
                result = await checkBtcSession(session);
            } else {
                result = await checkEvmSession(session);
            }

            if (!result) continue;

            if (result.hash) {
                await provisionPayment(session, result.hash, result.amountReceived);
            } else if (result.broadcastAt) {
                const isOnTime = result.broadcastAt <= expiresAt;
                const alreadyGrace = session.status === 'grace';
                if (isOnTime || alreadyGrace) {
                    await prisma.paymentSession.update({
                        where: { id: session.id },
                        data: {
                            status: 'grace',
                            txBroadcastAt: session.txBroadcastAt || result.broadcastAt,
                            amountReceived: result.amountReceived
                        }
                    });
                    if (!alreadyGrace) {
                        console.log(`[crypto-monitor] session ${session.id} entered grace — BTC tx seen at ${result.broadcastAt.toISOString()}`);
                    }
                }
            }
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
    setInterval(cleanupExpiredSessions, 6 * 60 * 60 * 1000);
    cleanupExpiredSessions();
}

module.exports = { startCryptoMonitor };
