// trimKey.js

import * as dotenv from 'dotenv';

dotenv.config();

// Load private key from .env
let privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in .env file');
}

// Remove '0x' prefix if present
if (privateKey.startsWith('0x')) {
    privateKey = privateKey.slice(2);
}

console.log(`Original hex length: ${privateKey.length}`);

// Trim first two hex characters (one byte)
if (privateKey.length > 64) {
    privateKey = privateKey.slice(2); // Remove first two chars
    console.log(`Trimmed key (removed first two chars): ${privateKey}`);
    console.log(`New hex length: ${privateKey.length}`);
}

// Validate length (64 hex chars = 32 bytes)
if (privateKey.length !== 64) {
    throw new Error(`Invalid hex key length: ${privateKey.length} characters (expected 64)`);
}

// Convert to bytes
let bytes;
try {
    bytes = Buffer.from(privateKey, 'hex');
} catch (error) {
    throw new Error(`Invalid hex string: ${error.message}`);
}

console.log(`Bytes length: ${bytes.length}`);

// Validate byte length
if (bytes.length !== 32) {
    throw new Error(`Invalid byte length: ${bytes.length} bytes (expected 32)`);
}