import express from 'express';
import morgan from 'morgan';
import { createSuiAddress } from './callers/createSuiAddress.js';
import { createWallet } from './callers/createWallet.js';
import { fundSuiAddress } from './callers/fundSuiAddress.js';
import { transferToWallet } from './callers/transferToWallet.js';
import { transferToAddress } from './callers/transferToAddress.js';
import { expendReward } from './callers/expendReward.js';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

const app = express();
app.use(express.json());

const SENDER_PRIVATE_KEY = process.env.PRIVATE_KEY;

app.use(morgan('dev')); // Logs requests in 'dev' format (method, URL, status, response time)
app.use(express.json()); // Parse JSON request bodies

// Log server startup
console.log('Starting Vomzer Socials Node.js Integration server...');



// Endpoint to create a new wallet
app.post('/api/create-sui-address', (req, res) => {
    try {
        console.log('Received POST /api/create-wallet:', {
            body: req.body,
            headers: req.headers,
        });

        // Call createSuiAddress and validate result
        const result = createSuiAddress();
        if (!result || !result.walletAddress || !result.privateKey) {
            throw new Error('Invalid response from createSuiAddress: missing walletAddress or privateKey');
        }

        console.log('createSuiAddress result:', result);

        res.json({
            success: true,
            walletAddress: result.walletAddress,
            privateKey: result.privateKey,
            messageForUser: 'Wallet created off-chain. Fund it with SUI tokens to use it on-chain.',
        });
    } catch (error) {
        console.error('Error in /api/create-wallet:', {
            message: error.message,
            stack: error.stack,
        });
        res.status(500).json({
            success: false,
            error: error.message,
            requestId: req.headers['x-request-id'] || 'unknown', // Include for tracing
        });
    }
});



// Endpoint to Fund a wallet with SUI
app.post('/api/fund-sui-address', async (req, res) => {
    try {
        // Explicit values
        const recipientWalletId = "0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f";
        const amount = 0.006; // 6_000_000 in number format (underscore is just for readability in some languages)

        if (!recipientWalletId || !recipientWalletId.startsWith('0x')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing recipient wallet address'
            });
        }
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing amount'
            });
        }
        if (!SENDER_PRIVATE_KEY) {
            return res.status(400).json({
                success: false,
                error: 'Sender private key not provided'
            });
        }

        let privateKey = SENDER_PRIVATE_KEY;
        if (privateKey.startsWith('0x')) {
            privateKey = privateKey.slice(2);
        }
        if (privateKey.length !== 64) {
            return res.status(400).json({
                success: false,
                error: `Invalid private key length: ${privateKey.length} characters (expected 64)`
            });
        }

        let privateKeyBytes;
        try {
            privateKeyBytes = Buffer.from(privateKey, 'hex');
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: `Invalid hex string in private key: ${error.message}`
            });
        }
        if (privateKeyBytes.length !== 32) {
            return res.status(400).json({
                success: false,
                error: `Invalid private key byte length: ${privateKeyBytes.length} bytes (expected 32)`
            });
        }

        let senderAddress;
        try {
            const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
            senderAddress = keypair.getPublicKey().toSuiAddress();
            console.log(`Derived sender address: ${senderAddress}`);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: `Failed to derive sender address: ${error.message}`
            });
        }

        // Convert amount from SUI to MIST (1 SUI = 10^9 MIST)
        const amountInMist = Math.floor(parseFloat(amount) * 1_000_000_000);

        const result = await fundSuiAddress({
            SENDER_PRIVATE_KEY: privateKeyBytes, // Pass bytes directly
            senderAddress,
            recipientWalletId,
            amount: amountInMist
        });

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json({
            success: true,
            transactionDigest: result.transactionDigest,
            message: `Successfully funded ${amount} SUI from ${senderAddress} to ${recipientWalletId}`
        });
    } catch (error) {
        console.error('Funding error:', error);
        res.status(500).json({
            success: false,
            error: `Funding failed: ${error.message}`
        });
    }
});



// Endpoint to create a Wallet object
app.post('/api/create-wallet', async (req, res) => {
    try {
        const { address, privateKey } = req.body || {};

        const result = await createWallet({
            address,
            privateKey,
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to create Wallet',
            });
        }

        res.json({
            success: true,
            walletObjectId: result.walletObjectId,
            transactionDigest: result.transactionDigest,
            address: result.address,
            messageForUser: `Successfully created Wallet object ${result.walletObjectId} for address ${result.address}`,
        });
    } catch (error) {
        console.error('Create Wallet error:', error);
        res.status(500).json({
            success: false,
            error: `Failed to create Wallet: ${error.message}`,
        });
    }
});



// Endpoint to transfer SUI to a wallet
app.post('/api/transfer-to-wallet', async (req, res) => {
    try {
        // Explicit values
        const destWalletId = "0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f";
        const amount = 0.00015; // 15_000 in number format (underscore is just for readability in some languages)

        if (!destWalletId || !destWalletId.startsWith('0x')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing recipient wallet address'
            });
        }
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing amount'
            });
        }

        // Convert amount from SUI to MIST (1 SUI = 10^9 MIST)
        const amountInMist = Math.floor(parseFloat(amount) * 1_000_000_000);

        const result = await transferToWallet({
            senderPrivateKey: SENDER_PRIVATE_KEY,
            destWalletId,
            amount: amountInMist
        });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Transaction failed',
            });
        }

        res.json({
            success: true,
            transactionDigest: result.transactionDigest,
            messageForUser: `Successfully transferred ${amount} SUI to ${destWalletId}`
        });
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({
            success: false,
            error: `Transfer failed: ${error.message}`
        });
    }
});



// Endpoint to transfer SUI to an address
app.post('/api/transfer-to-address', async (req, res) => {
    try {
        // Explicit values
        const destWalletId = "0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f";
        const amount = 0.00004; // 4_000_0000 in number format (underscore is just for readability in some languages)

        if (!destWalletId || !destWalletId.startsWith('0x')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing recipient wallet address'
            });
        }
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing amount'
            });
        }

        // Convert amount from SUI to MIST (1 SUI = 10^9 MIST)
        const amountInMist = Math.floor(parseFloat(amount) * 1_000_000_000);

        const result = await transferToAddress({
            senderPrivateKey: SENDER_PRIVATE_KEY,
            destWalletId,
            amount: amountInMist
        });

        res.json({
            success: true,
            transactionDigest: result.transactionDigest,
            messageForUser: `Successfully transferred ${amount} SUI to ${destWalletId}`
        });
    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({
            success: false,
            error: `Transfer failed: ${error.message}`
        });
    }
});



// Endpoint to Disburse SUI to a wallet
app.post('/api/expend-reward', async (req, res) => {
    try {
        // Explicit values
        const recipientWalletId = "0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f";
        const amount = 0.012;

        if (!recipientWalletId || !recipientWalletId.startsWith('0x')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing recipient wallet address'
            });
        }
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing amount'
            });
        }
        if (!SENDER_PRIVATE_KEY) {
            return res.status(400).json({
                success: false,
                error: 'Sender private key not provided'
            });
        }

        let privateKey = SENDER_PRIVATE_KEY;
        if (privateKey.startsWith('0x')) {
            privateKey = privateKey.slice(2);
        }
        if (privateKey.length !== 64) {
            return res.status(400).json({
                success: false,
                error: `Invalid private key length: ${privateKey.length} characters (expected 64)`
            });
        }

        let privateKeyBytes;
        try {
            privateKeyBytes = Buffer.from(privateKey, 'hex');
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: `Invalid hex string in private key: ${error.message}`
            });
        }
        if (privateKeyBytes.length !== 32) {
            return res.status(400).json({
                success: false,
                error: `Invalid private key byte length: ${privateKeyBytes.length} bytes (expected 32)`
            });
        }

        let senderAddress;
        try {
            const keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
            senderAddress = keypair.getPublicKey().toSuiAddress();
            console.log(`Derived sender address: ${senderAddress}`);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: `Failed to derive sender address: ${error.message}`
            });
        }

        // Convert amount from SUI to MIST (1 SUI = 10^9 MIST)
        const amountInMist = Math.floor(parseFloat(amount) * 1_000_000_000);

        const result = await expendReward({
            SENDER_PRIVATE_KEY: privateKeyBytes,
            senderAddress,
            recipientWalletId,
            amount: amountInMist
        });

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json({
            success: true,
            transactionDigest: result.transactionDigest,
            messageForUser: `Successfully funded ${amount} SUI from ${senderAddress} to ${recipientWalletId}`
        });
    } catch (error) {
        console.error('Funding error:', error);
        res.status(500).json({
            success: false,
            error: `Funding failed: ${error.message}`
        });
    }
});



//Use the PORT in .env
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        requestId: req.headers['x-request-id'] || 'unknown',
    });
});

