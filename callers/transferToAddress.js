import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { client } from '../suiClient.js';

const PACKAGE_ID = process.env.PACKAGE_ID;
const MODULE_NAME = process.env.MODULE_NAME;

// Replace this with your actual testnet wallet's private key for testing
const SENDER_PRIVATE_KEY = process.env.PRIVATE_KEY;


function getKeypairFromPrivateKey(hexKey) {
    if (!hexKey) {
        throw new Error('Private key is required');
    }
    let privateKey = hexKey.startsWith('0x') ? hexKey.slice(2) : hexKey;

    if (privateKey.length !== 64) {
        throw new Error(`Invalid private key length: ${privateKey.length} characters (expected 64)`);
    }

    let secretKey;
    try {
        secretKey = Buffer.from(privateKey, 'hex');
    } catch (error) {
        throw new Error(`Invalid hex string in private key: ${error.message}`);
    }
    if (secretKey.length !== 32) {
        throw new Error(`Invalid private key byte length: ${secretKey.length} bytes (expected 32)`);
    }
    try {
        return Ed25519Keypair.fromSecretKey(secretKey);
    } catch (error) {
        throw new Error(`Failed to derive keypair: ${error.message}`);
    }
}

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

async function checkBalance(walletAddress) {
    try {
        const balance = await client.getBalance({ owner: walletAddress });
        return parseInt(balance.totalBalance); // Balance in MIST
    } catch (error) {
        console.error('Failed to check balance:', error);
        throw error;
    }
}


export async function transferToAddress({
       senderPrivateKey = SENDER_PRIVATE_KEY,
       recipientAddress = '0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f',
       amount = 5_000_000,
   }) {
    try {
        const senderKeypair = getKeypairFromPrivateKey(senderPrivateKey);
        const senderAddress = senderKeypair.getPublicKey().toSuiAddress();

        if (!recipientAddress || !recipientAddress.startsWith('0x')) {
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
                txb.object(recipientAddress),
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


export function getSenderAddress(senderPrivateKey = SENDER_PRIVATE_KEY) {
    try {
        const keypair = getKeypairFromPrivateKey(senderPrivateKey);
        return keypair.getPublicKey().toSuiAddress();
    } catch (error) {
        console.error('Failed to derive sender address:', error);
        throw new Error('Invalid private key');
    }
}

