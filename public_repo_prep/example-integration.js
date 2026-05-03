/**
 * sentinelpay api - basic integration example
 * demonstrate how to perform a wallet risk scan.
 */

const axios = require('axios');

const sentinel_api_url = 'https://api.sentinelpay.org/v1/scan';
const api_key = 'your_api_key_here';

async function checkwalletrisk(walletaddress) {
    console.log(`[sentinel] initiating scan for: ${walletaddress}...`);
    
    try {
        const response = await axios.post(sentinel_api_url, {
            address: walletaddress
        }, {
            headers: {
                'x-api-key': api_key,
                'content-type': 'application/json'
            }
        });

        const { score, risk_level, flags } = response.data;

        console.log('-----------------------------------');
        console.log(`score: ${score}/100`);
        console.log(`level: ${risk_level.toLowerCase()}`);
        console.log(`flags: ${flags.length > 0 ? flags.join(', ') : 'none'}`);
        console.log('-----------------------------------');

        if (score > 70) {
            console.warn('[action] deposit blocked: high risk detected.');
        } else {
            console.log('[action] deposit approved.');
        }

    } catch (error) {
        const msg = error.response ? error.response.data.error : error.message;
        console.error(`[error] scan failed: ${msg}`);
    }
}

// usage example
const targetwallet = '0x000000000000000000000000000000000000dead';
checkwalletrisk(targetwallet);
