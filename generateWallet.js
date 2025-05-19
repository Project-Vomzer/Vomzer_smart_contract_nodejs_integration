const express = require('express');
const { SuiClient, getFullnodeUrl } = require('@mysten/sui.js/client');
const { ZkLoginSignature, getZkLoginAddress } = require('@mysten/sui.js/zklogin');
const { OAuth2Client } = require('google-auth-library');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

dotenv.config();

const app = express();
const port = 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';
const SALT_SECRET = process.env.SALT_SECRET || 'your_salt_secret';

// Sui client
const suiClient = new SuiClient({ url: getFullnodeUrl('devnet') });

// Google OAuth client
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Generate deterministic salt
function generateSalt(username) {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', SALT_SECRET).update(username).digest('hex');
}

// Generate wallet (zkLogin registration)
app.post('/generate-wallet', async (req, res) => {
    const { username, jwt } = req.body;

    try {
        // Verify Google OAuth JWT
        const ticket = await googleClient.verifyIdToken({
            idToken: jwt,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        if (payload.sub !== username) {
            return res.status(401).json({ success: false, error: 'Username mismatch in JWT' });
        }

        // Generate salt
        const salt = generateSalt(username);

        // Derive zkLogin address
        const zkLoginSignature = new ZkLoginSignature({
            jwt,
            salt,
            maxEpoch: 100
        });
        const walletAddress = await getZkLoginAddress({
            client: suiClient,
            signature: zkLoginSignature
        });
        const publicKey = 'zklogin-' + walletAddress; // Simplified

        res.status(200).json({
            success: true,
            walletAddress,
            suiAddress: walletAddress,
            publicKey,
            username,
            salt, // Return salt for backend storage
            walletObjectId: 'zklogin-object-id',
            transactionDigest: 'zklogin-tx-digest'
        });
    } catch (error) {
        console.error('Generate wallet error:', error);
        res.status(401).json({ success: false, error: `Invalid JWT or error: ${error.message}` });
    }
});

// Verify login (zkLogin authentication)
app.post('/verify-login', async (req, res) => {
    const { username, jwt } = req.body;

    try {
        // Verify Google OAuth JWT
        const ticket = await googleClient.verifyIdToken({
            idToken: jwt,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        if (payload.sub !== username) {
            return res.status(401).json({ success: false, error: 'Username mismatch in JWT' });
        }

        // Note: Backend provides salt from MySQL; Node.js derives address
        // For simplicity, regenerate salt (consistent with registration)
        const salt = generateSalt(username);

        // Derive zkLogin address
        const zkLoginSignature = new ZkLoginSignature({
            jwt,
            salt,
            maxEpoch: 100
        });
        const walletAddress = await getZkLoginAddress({
            client: suiClient,
            signature: zkLoginSignature
        });
        const publicKey = 'zklogin-' + walletAddress;

        res.status(200).json({
            success: true,
            walletAddress,
            suiAddress: walletAddress,
            publicKey,
            username
        });
    } catch (error) {
        console.error('Verify login error:', error);
        res.status(401).json({ success: false, error: `Invalid JWT or error: ${error.message}` });
    }
});

// Get public key (fallback for frontend)
app.post('/get-public-key', async (req, res) => {
    const { username } = req.body;
    // Note: Node.js doesn't store data; redirect to backend or handle via frontend
    res.status(400).json({ success: false, error: 'Public key retrieval not supported; use backend database' });
});

app.listen(port, () => {
    console.log(`Node.js service running on port ${port}`);
});