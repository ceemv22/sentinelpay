const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY = process.env.MASTER_ENCRYPTION_KEY;

function encrypt(text) {
    if (!KEY) {
        throw new Error('MASTER_ENCRYPTION_KEY not set');
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Format: v1:iv:tag:encrypted (S-Tier versioning for future-proof rotation)
    return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
    if (!KEY) {
        throw new Error('MASTER_ENCRYPTION_KEY not set');
    }
    
    // Handle versioned prefix
    if (!encryptedText.startsWith('v1:')) {
        throw new Error('Unsupported encryption version or legacy format');
    }
    
    const parts = encryptedText.split(':');
    const [version, ivHex, tagHex, encrypted] = parts;
    
    if (!ivHex || !tagHex || !encrypted) {
        throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(KEY, 'hex'), iv);
    
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

module.exports = { encrypt, decrypt };
