import express from 'express';
import { createWallet } from './callers/createWallet.js';
import { fundWallet } from './callers/fundWallet.js';
import { transferToWallet } from './callers/transferToWallet.js';
import { transferToAddress } from './callers/transferToAddress.js';
import { expendReward } from './callers/expendReward.js';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

const app = express();
app.use(express.json());

const SENDER_PRIVATE_KEY = process.env.PRIVATE_KEY;


// Endpoint to create a new wallet
app.post('/api/create-wallet', (req, res) => {
    try {
        const result = createWallet(); // No async needed since it's off-chain
        res.json({
            success: true,
            walletAddress: result.walletAddress,
            privateKey: result.privateKey,
            messageForUser: "Wallet created off-chain. Fund it with SUI tokens to use it on-chain."
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// Endpoint to Fund a wallet with SUI
app.post('/api/fund-wallet', async (req, res) => {
    try {
        // Explicit values
        const recipientWalletId = "0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f";
        const amount = 0.006; // 12_000_000 in number format (underscore is just for readability in some languages)

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

        const result = await fundWallet({
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



// Endpoint to transfer SUI to a wallet
app.post('/api/transfer-to-wallet', async (req, res) => {
    try {
        // Explicit values
        const destWalletId = "0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f";
        const amount = 0.000015; // 15_000 in number format (underscore is just for readability in some languages)

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
        const amount = 0.005; // 5_000_000 in number format (underscore is just for readability in some languages)

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


// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

//Use the PORT in .env
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});