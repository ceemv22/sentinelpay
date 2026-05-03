# sentinelpay public core

the transparency layer for the sentinelpay security infrastructure.

sentinelpay is a high-performance b2b risk scoring engine designed for crypto operators, casinos, and financial platforms. this repository contains the public-facing sdk documentation, integration examples, and auditable frontend components.

## mission
our mission is to eliminate deposit-related fraud in the crypto ecosystem. we provide sub-second risk assessment for any evm wallet, allowing operators to block high-risk actors before they interact with their smart contracts.

## integration
to integrate sentinelpay into your platform, you simply need to interact with our rest api.

### example scan (node.js)
```javascript
const axios = require('axios');

async function scanwallet(address) {
    try {
        const response = await axios.post('https://api.sentinelpay.org/v1/scan', {
            address: address
        }, {
            headers: { 'x-api-key': 'your_sentinel_key' }
        });
        
        console.log(`risk score: ${response.data.score}/100`);
        console.log(`flags: ${response.data.flags.join(', ')}`);
    } catch (err) {
        console.error('scan failed:', err.response?.data?.error || err.message);
    }
}

scanwallet('0x...');
```

## security and privacy
while our core scoring engine logic remains proprietary (private) to prevent bypass attempts, we maintain this public repository to provide transparent sdks and document our security standards.

## links
- [official website](https://sentinelpay.org)
- [api documentation](https://sentinelpay.org/docs)
- [twitter / x](https://x.com/sentinelpayorg)
