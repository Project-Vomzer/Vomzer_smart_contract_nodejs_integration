import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { client } from '../suiClient.js';

const PACKAGE_ID = process.env.PACKAGE_ID;
const MODULE_NAME = process.env.MODULE_NAME;


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