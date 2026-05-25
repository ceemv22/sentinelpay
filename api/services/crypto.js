const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const KEY_HEX = process.env.MASTER_ENCRYPTION_KEY;
if (!KEY_HEX || !/^[0-9a-f]{64}$/i.test(KEY_HEX)) {
    throw new Error('MASTER_ENCRYPTION_KEY must be a 64-character hex string (256-bit AES key)');
}
const KEY = Buffer.from(KEY_HEX, 'hex');

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
    if (!encryptedText.startsWith('v1:')) {
        throw new Error('Unsupported encryption version');
    }
    const parts = encryptedText.split(':');
    const [, ivHex, tagHex, encrypted] = parts;
    if (!ivHex || !tagHex || !encrypted) {
        throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = { encrypt, decrypt };
