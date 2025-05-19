import express from 'express';
import morgan from 'morgan';
import { createSuiAddressOffChain } from './callers/createSuiAddressOffChain.js';
import { createSuiAddressOnChain } from './callers/createSuiAddressOnChain.js';
import { createWallet } from './callers/createWallet.js';
import { fundSuiAddress } from './callers/fundSuiAddress.js';
import { transferToWallet} from './callers/transferToWallet.js';
import { depositToWallet } from './callers/depositToWallet.js';
import { transferToAddress } from './callers/transferToAddress.js';
import { expendReward } from './callers/expendReward.js';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';



import jwt from 'jsonwebtoken';
import { verifyZkLoginProof } from '@mysten/sui.js/zklogin';
import fetch from 'node-fetch'; // For fetching Google's JWKS

const app = express();
app.use(express.json());

const SENDER_PRIVATE_KEY = process.env.PRIVATE_KEY;

app.use(morgan('dev')); // Logs requests in 'dev' format (method, URL, status, response time)
app.use(express.json()); // Parse JSON request bodies

// Log server startup
console.log('Starting Vomzer Socials Node.js Integration server...');



// Function to fetch Google's JWKS for JWT verification
async function getGooglePublicKey(kid) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    const jwks = await response.json();
    const key = jwks.keys.find(k => k.kid === kid);
    if (!key) {
        throw new Error('Public key not found for provided kid');
    }
    // Convert JWK to PEM format (simplified, use a library like 'jwk-to-pem' in production)
    return key;
}


// Endpoint to handle wallet generation with JWT and zk-proof verification
app.post('/generate-wallet', async (req, res) => {
    try {
        const { jwt: jwtToken, zkProof, username } = req.body;

        // Validate request body
        if (!jwtToken || !zkProof || !username) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: jwt, zkProof, or username'
            });
        }

        // Step 1: Verify Google OAuth JWT
        let decodedJwt;
        try {
            // Decode JWT to get header for kid
            const decodedHeader = jwt.decode(jwtToken, { complete: true });
            if (!decodedHeader || !decodedHeader.header.kid) {
                throw new Error('Invalid JWT header or missing kid');
            }

            // Fetch Google's public key for the kid
            const publicKey = await getGooglePublicKey(decodedHeader.header.kid);

            // Verify JWT
            decodedJwt = jwt.verify(jwtToken, publicKey, {
                issuer: 'https://accounts.google.com',
                audience: process.env.GOOGLE_CLIENT_ID
            });

            if (!decodedJwt.email || !decodedJwt.sub) {
                throw new Error('JWT missing required claims: email or sub');
            }
        } catch (error) {
            console.error('JWT verification failed:', error);
            return res.status(401).json({
                success: false,
                error: `JWT verification failed: ${error.message}`
            });
        }

        // Step 2: Verify zk-proof using @mysten/sui.js/zklogin
        try {
            const zkProofInputs = zkProof; // Assuming zkProof is the serialized ZkLoginSignatureInputs
            const isValidProof = await verifyZkLoginProof(zkProofInputs);

            if (!isValidProof) {
                throw new Error('Invalid zk-proof');
            }

            // Verify that the zk-proof corresponds to the JWT's sub (user ID)
            const expectedAddress = decodedJwt.sub; // Adjust based on how address is derived in your zkLogin setup
            if (zkProofInputs.address !== expectedAddress) {
                throw new Error('zk-proof address does not match JWT user ID');
            }
        } catch (error) {
            console.error('zk-proof verification failed:', error);
            return res.status(400).json({
                success: false,
                error: `zk-proof verification failed: ${error.message}`
            });
        }

        // Step 3: Proceed to create the wallet
        console.log(`Creating wallet for user: ${username}, email: ${decodedJwt.email}`);
        const result = await createSuiAddressOnChain();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to create wallet'
            });
        }

        // Return wallet details
        res.status(200).json({
            success: true,
            walletObjectId: result.walletObjectId,
            walletAddress: result.walletAddress,
            privateKey: result.privateKey,
            transactionDigest: result.transactionDigest,
            senderAddress: result.senderAddress,
            messageForUser: `Wallet created for ${username}`
        });
    } catch (error) {
        console.error('Error in /generate-wallet:', error);
        res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});



// Endpoint to create a new wallet
app.post('/api/create-sui-address-off-chain', (req, res) => {
    try {
        console.log('Received POST /api/create-sui-address_off-chain', {
            body: req.body,
            headers: req.headers,
        });

        // Call createSuiAddress and validate result
        const result = createSuiAddressOffChain();
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
        console.error('Error in /api/create-sui-address-off-chain', {
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



//End point to create sui address on chain
app.post('/api/create-sui-address-on-chain', async (req, res) => {
    try {
        console.log('Creating Sui address on-chain...');
        const result = await createSuiAddressOnChain();

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(200).json({
            success: true,
            walletObjectId: result.walletObjectId,
            walletAddress: result.walletAddress,
            privateKey: result.privateKey,
            transactionDigest: result.transactionDigest,
            senderAddress: result.senderAddress,
            messageForUser: 'Wallet created on-chain with new address as owner. Fund it with SUI tokens to use it further.',
        });
    } catch (error) {
        console.error('Error in /api/create-sui-address-on-chain', error);
        res.status(500).json({ success: false, error: `Server error: ${error.message}` });
    }
});



// Endpoint to Fund a Sui address
app.post('/api/fund-sui-address', async (req, res) => {
    try {
        const { senderPrivateKey, recipientWalletId, amount } = req.body;

        // Validate inputs
        if (!recipientWalletId || !recipientWalletId.match(/^0x[0-9a-fA-F]{64}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing recipient wallet address: must be a 66-character hex string starting with 0x',
            });
        }
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing amount: must be a positive number in SUI',
            });
        }

        console.log(`Processing fund request: ${amount} SUI to ${recipientWalletId}`);

        // Call fundSuiAddress
        const result = await fundSuiAddress({
            senderPrivateKey,
            recipientWalletId,
            amount,
        });

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(200).json({
            success: true,
            transactionDigest: result.transactionDigest,
            senderAddress: result.senderAddress,
            amountInSui: result.amountInSui,
            amountInMist: result.amountInMist,
            message: result.message,
        });
    } catch (error) {
        console.error('Error in /api/fund-sui-address:', error);
        res.status(500).json({
            success: false,
            error: `Funding failed: ${error.message}`,
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



app.post('/api/deposit-to-wallet', async (req, res) => {
    try {
        // Hardcoded parameters for testing
        const depositParams = {
            senderPrivateKey: process.env.PRIVATE_KEY,
            walletId: "0x03355332cb05eb346e8b71de30c374726bb703f00c15582b598e11a01693009e",
            amountInMist: 30_000_000 // 0.0001 SUI
        };

        // Call depositToWallet with hardcoded parameters
        const result = await depositToWallet(depositParams);

        if (result.success) {
            res.status(200).json({
                success: true,
                transactionDigest: result.transactionDigest,
                senderAddress: result.senderAddress
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Deposit API error:', error.stack);
        res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});



// Endpoint to transfer SUI to a wallet
app.post('/api/transfer-to-wallet', async (req, res) => {
    try {
        // Hardcoded parameters for testing
        const transferParams = {
            senderPrivateKey: process.env.PRIVATE_KEY,
            sourceWalletId: "0x03355332cb05eb346e8b71de30c374726bb703f00c15582b598e11a01693009e",
            destWalletId: "0xb38b6ca8dd130ee6938a20a4cccbcb33c62c693c012eb3b2de951a5cf5006012",
            recipientAddress: "0x52f03ac4ac477f9ec51f0e51b9a6d720a311e3a8c0c11cd8c2eeb9eb44d475e5",
            amount: 0.007 // Amount in MIST (0.00006 SUI)
        };

        // Call transferToWallet with hardcoded parameters
        const result = await transferToWallet(transferParams);

        if (result.success) {
            res.status(200).json({
                success: true,
                transactionDigest: result.transactionDigest,
                senderAddress: result.senderAddress
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Transfer API error:', error.stack);
        res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});

// API endpoint to fetch available wallet objects for an address
app.post('/api/wallet-objects', async (req, res) => {
    try {
        const { address } = req.body;
        if (!address || !address.startsWith('0x')) {
            return res.status(400).json({
                success: false,
                error: 'Valid Sui address is required'
            });
        }

        const walletObjects = await getAvailableWalletObjects(address);
        res.status(200).json({
            success: true,
            walletObjects
        });
    } catch (error) {
        console.error('Wallet objects API error:', error.stack);
        res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});



// Endpoint to transfer SUI to an address
app.post('/api/transfer-to-address', async (req, res) => {
    try {
        // Explicit values
        const recipientAddress = "0x28b7cefa1e46d3e6d695a0f465b72033279e076bb7240c7715ec5950e9004e08";
        const amount = 0.007; // Amount in SUI

        if (!recipientAddress || !recipientAddress.startsWith('0x')) {
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
            recipientAddress,
            amount: amountInMist
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error || 'Transaction failed'
            });
        }

        res.status(200).json({
            success: true,
            transactionDigest: result.transactionDigest,
            messageForUser: `Successfully transferred ${amount} SUI to ${recipientAddress}`
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

