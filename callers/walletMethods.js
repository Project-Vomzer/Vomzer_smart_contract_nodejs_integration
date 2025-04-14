import { Transaction } from '@mysten/sui/transactions';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { client } from '../suiClient.js';

const PACKAGE_ID = process.env.PACKAGE_ID;
const MODULE_NAME = process.env.MODULE_NAME;

// Placeholder for your testnet funded wallet's private key (base64-encoded)
// Replace this with your actual testnet wallet's private key for testing
const SENDER_PRIVATE_KEY = process.env.PRIVATE_KEY;

// Derive keypair from hex private key
function getKeypairFromPrivateKey(hexKey) {
    if (!hexKey) {
        throw new Error('Private key is required');
    }
    let privateKey = hexKey.startsWith('0x') ? hexKey.slice(2) : hexKey;

    if (privateKey.length !== 64) {
        throw new Error(`Invalid private key length: ${privateKey.length} characters (expected 64)`);
    }

    // Convert to bytes
    let secretKey;
    try {
        secretKey = Buffer.from(privateKey, 'hex');
    } catch (error) {
        throw new Error(`Invalid hex string in private key: ${error.message}`);
    }

    // Validate byte length
    if (secretKey.length !== 32) {
        throw new Error(`Invalid private key byte length: ${secretKey.length} bytes (expected 32)`);
    }

    try {
        return Ed25519Keypair.fromSecretKey(secretKey);
    } catch (error) {
        throw new Error(`Failed to derive keypair: ${error.message}`);
    }
}


// Native SUI transfer
export async function fundWallet({
         senderPrivateKey = SENDER_PRIVATE_KEY,
         senderAddress = "0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f",
         recipientWalletId,
         amount = 12_000_000, // Amount in MIST (0.012 SUI)
     }) {
    try {
        if (!senderPrivateKey) {
            throw new Error('senderPrivateKey is required');
        }
        if (!recipientWalletId || !recipientWalletId.startsWith('0x')) {
            throw new Error('Invalid recipient wallet address');
        }
        if (!amount || amount <= 0) {
            throw new Error('Invalid transfer amount');
        }

        // Derive keypair and sender address
        const senderKeypair = getKeypairFromPrivateKey(senderPrivateKey);
        const derivedSenderAddress = senderKeypair.getPublicKey().toSuiAddress();

        // If senderAddress was provided, verify it matches the derived address
        if (senderAddress && senderAddress !== derivedSenderAddress) {
            throw new Error('Provided sender address does not match derived address');
        }

        console.log(`Funding ${amount} MIST to ${recipientWalletId} from ${derivedSenderAddress}`);

        // Create transaction
        const txb = new TransactionBlock();
        const [coin] = txb.splitCoins(txb.gas, [amount]);
        txb.transferObjects([coin], recipientWalletId);

        // Sign and execute transaction
        const result = await client.signAndExecuteTransactionBlock({
            transactionBlock: txb,
            signer: senderKeypair,
            requestType: 'WaitForLocalExecution',
            options: { showEffects: true },
        });

        return {
            success: true,
            transactionDigest: result.digest,
            senderAddress: derivedSenderAddress,
            messageForUser: `Successfully funded ${(amount / 1_000_000_000).toFixed(9)} SUI to ${recipientWalletId}`,
        };
    } catch (error) {
        console.error('Native SUI funding failed:', error);
        return { success: false, error: `Funding failed: ${error.message}` };
    }
}



// Helper function to execute transactions
async function executeTransaction(txb, keypair) {
    try {
        const result = await client.signAndExecuteTransaction({
            transaction: txb,
            signer: keypair,
        });
        return result;
    } catch (error) {
        console.error('Transaction failed:', error);
        throw error;
    }
}


// Function to check wallet balance
async function checkBalance(walletAddress) {
    try {
        const balance = await client.getBalance({ owner: walletAddress });
        return parseInt(balance.totalBalance); // Balance in MIST
    } catch (error) {
        console.error('Failed to check balance:', error);
        throw error;
    }
}


//  Transfer SUI tokens to a wallet using the transfer_to_wallet function
export async function transferToWallet({
       senderPrivateKey = TESTNET_SENDER_PRIVATE_KEY,
       destWalletId = '0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f',
       amount = 150_000_000,
   }) {
    try {
        const senderKeypair = getKeypairFromPrivateKey(senderPrivateKey);
        const senderAddress = senderKeypair.getPublicKey().toSuiAddress();

        if (!destWalletId || !destWalletId.startsWith('0x')) {
            throw new Error('Invalid recipient wallet address');
        }
        if (!amount || amount <= 0) {
            throw new Error('Invalid transfer amount');
        }

        const balance = await checkBalance(senderAddress);
        const gasEstimate = 1_000_000;

        if (balance < amount + gasEstimate) {
            throw new Error('Insufficient balance for transfer and gas');
        }

        const txb = new Transaction();

        txb.moveCall({
            target: `${PACKAGE_ID}::${MODULE_NAME}::transfer_to_wallet`,
            arguments: [
                txb.object(senderAddress),
                txb.object(destWalletId),
                txb.pure.u64(amount),
            ],
        });

        const result = await executeTransaction(txb, senderKeypair);
        return {
            success: true,
            transactionDigest: result.digest,
            senderAddress,
        };
    } catch (error) {
        console.error('Transfer failed:', error);
        return { success: false, error: `Transfer failed: ${error.message}` };
    }
}

// Derive sender address from private key
export function getSenderAddress(senderPrivateKey = TESTNET_SENDER_PRIVATE_KEY) {
    try {
        const keypair = getKeypairFromPrivateKey(senderPrivateKey);
        return keypair.getPublicKey().toSuiAddress();
    } catch (error) {
        console.error('Failed to derive sender address:', error);
        throw new Error('Invalid private key');
    }
}


// Create Wallet with a new keypair for each user
export function createWallet() {
    // Generate a new Ed25519 keypair
    const keypair = Ed25519Keypair.generate();

    // Derive the Sui wallet address from the public key
    const walletAddress = keypair.getPublicKey().toSuiAddress();

    // Get the private key as a base64-encoded string
    const privateKey = keypair.getSecretKey();

    return {
        walletAddress,
        privateKey,
    };
}






// // Export other wallet functions as needed
// export async function deposit(walletAddress, amount) {
//     // Implementation for depositing SUI
// }
//
// export async function transferToAddress(fromAddress, toAddress, amount) {
//     // Implementation for transferring SUI
// }