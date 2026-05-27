const { ethers } = require('ethers');
const { HDKey } = require('@scure/bip32');
const { mnemonicToSeedSync } = require('@scure/bip39');
const { bech32 } = require('bech32');
const crypto = require('crypto');

const EVM_NETWORKS = new Set(['ethereum', 'bsc', 'polygon']);

function getMnemonic() {
    const m = process.env.CRYPTO_MASTER_SEED;
    if (!m) throw new Error('CRYPTO_MASTER_SEED not configured');
    return m;
}

function deriveEvmAddress(index) {
    const hdNode = ethers.HDNodeWallet.fromPhrase(getMnemonic());
    return hdNode.derivePath(`m/44'/60'/0'/0/${index}`).address;
}

function deriveBtcAddress(index) {
    const seed = mnemonicToSeedSync(getMnemonic());
    const hd = HDKey.fromMasterSeed(seed);
    const child = hd.derive(`m/84'/0'/0'/0/${index}`);
    const sha256 = crypto.createHash('sha256').update(child.publicKey).digest();
    const hash160 = crypto.createHash('ripemd160').update(sha256).digest();
    const words = bech32.toWords(hash160);
    words.unshift(0x00);
    return bech32.encode('bc', words);
}

function deriveAddress(network, index) {
    if (EVM_NETWORKS.has(network)) return deriveEvmAddress(index);
    if (network === 'bitcoin') return deriveBtcAddress(index);
    throw new Error(`unsupported network: ${network}`);
}

module.exports = { deriveAddress };
