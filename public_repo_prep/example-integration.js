/**
 * SentinelPay API - Basic Integration Example
 * This script demonstrates how to perform a wallet risk scan.
 */

const axios = require('axios');

const SENTINEL_API_URL = 'https://api.sentinelpay.org/v1/scan';
const API_KEY = 'YOUR_API_KEY_HERE';

async function checkWalletRisk(walletAddress) {
    console.log(`[sentinel] initiating scan for: ${walletAddress}...`);
    
    try {
        const response = await axios.post(SENTINEL_API_URL, {
            address: walletAddress
        }, {
            headers: {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        const { score, risk_level, flags } = response.data;

        console.log('-----------------------------------');
        console.log(`SCORE: ${score}/100`);
        console.log(`LEVEL: ${risk_level.toUpperCase()}`);
        console.log(`FLAGS: ${flags.length > 0 ? flags.join(', ') : 'none'}`);
        console.log('-----------------------------------');

        if (score > 70) {
            console.warn('[ACTION] deposit blocked: high risk detected.');
        } else {
            console.log('[ACTION] deposit approved.');
        }

    } catch (error) {
        const msg = error.response ? error.response.data.error : error.message;
        console.error(`[error] scan failed: ${msg}`);
    }
}

// Usage Example
const targetWallet = '0x000000000000000000000000000000000000dEaD';
checkWalletRisk(targetWallet);
