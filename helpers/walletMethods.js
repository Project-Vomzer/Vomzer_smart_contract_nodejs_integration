// walletFunctions.js
import { Transaction } from '@mysten/sui/transactions';
import { client, keypair } from 'suiClient.js';

const PACKAGE_ID = process.env.PACKAGE_ID;
const MODULE_NAME = process.env.MODULE_NAME;

// Helper function to execute transactions
async function executeTransaction(txb) {
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


// 1. Create Wallet
export async function createWallet() {
    const txb = new Transaction();

    txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::create_wallet`,
        arguments: [],
    });

    return await executeTransaction(txb);
}

// 2. Deposit
export async function deposit(walletId, coinObjectId) {
    const txb = new Transaction();

    txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::deposit`,
        arguments: [
            txb.object(walletId),
            txb.object(coinObjectId),
        ],
    });

    return await executeTransaction(txb);
}

// 3. Transfer to Wallet
export async function transferToWallet(sourceWalletId, destWalletId, amount) {
    const txb = new Transaction();

    txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::transfer_to_wallet`,
        arguments: [
            txb.object(sourceWalletId),
            txb.object(destWalletId),
            txb.pure.u64(amount),
        ],
    });

    return await executeTransaction(txb);
}

// 4. Transfer to Address
export async function transferToAddress(sourceWalletId, recipientAddress, amount) {
    const txb = new Transaction();

    txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::transfer_to_address`,
        arguments: [
            txb.object(sourceWalletId),
            txb.pure.address(recipientAddress),
            txb.pure.u64(amount),
        ],
    });

    return await executeTransaction(txb);
}

// 5. Receive
export async function receive(walletId, coinObjectId) {
    const txb = new Transaction();

    txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::receive`,
        arguments: [
            txb.object(walletId),
            txb.object(coinObjectId),
        ],
    });

    return await executeTransaction(txb);
}

// Example usage:
/*
async function main() {
    try {
        // Create a new wallet
        const createResult = await createWallet();
        console.log('Wallet created:', createResult);

        // Example deposit (you'd need a valid coin object ID)
        // const depositResult = await deposit(walletId, coinId);

        // Example transfer to wallet
        // const transferResult = await transferToWallet(sourceWalletId, destWalletId, 1000000);
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
*/