import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { client } from '../suiClient.js';

const PACKAGE_ID = process.env.PACKAGE_ID;
const MODULE_NAME = process.env.MODULE_NAME;


// Replace this with your actual testnet wallet's private key for testing
const SENDER_PRIVATE_KEY = process.env.PRIVATE_KEY;
const SENDER_WALLET_OBJECT_ID = process.env.SENDER_WALLET_OBJECT_ID;
const RECIPIENT_WALLET_OBJECT_ID = process.env.RECIPIENT_WALLET_OBJECT_ID;

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
        const result = await client.signAndExecuteTransactionBlock({
            transactionBlock: txb,
            signer: keypair,
            options: {
                showEffects: true,
                showEvents: true,
            },
        });
        return result;
    } catch (error) {
        console.error('Transaction failed:', error.stack);
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


async function getWalletObjectId(address) {
    try {
        const objects = await client.getOwnedObjects({
            owner: address,
            options: { showType: true },
        });
        const walletObject = objects.data.find(
            (obj) => obj.data?.type === `${PACKAGE_ID}::${MODULE_NAME}::Wallet`
        );
        if (!walletObject) {
            throw new Error(`No Wallet object found for address ${address}`);
        }
        return walletObject.data.objectId;
    } catch (error) {
        console.error(`Failed to fetch Wallet object for ${address}:`, error);
        throw error;
    }
}



export async function transferToWallet({ senderPrivateKey, destWalletId, amount }) {
    try {
        if (!senderPrivateKey) {
            throw new Error('Sender private key is required');
        }
        const senderKeypair = getKeypairFromPrivateKey(senderPrivateKey);
        const senderAddress = senderKeypair.getPublicKey().toSuiAddress();

        if (!destWalletId || !destWalletId.startsWith('0x')) {
            throw new Error('Invalid recipient wallet address');
        }
        if (!amount || amount <= 0) {
            throw new Error('Invalid transfer amount');
        }


        // Fetch Wallet object IDs
        // const sourceWalletId = await getWalletObjectId(senderAddress);
        // const destWalletObjectId = await getWalletObjectId(destWalletId);

        // Use hardcoded Wallet object IDs from environment variables
        const sourceWalletId = SENDER_WALLET_OBJECT_ID;
        const destWalletObjectId = RECIPIENT_WALLET_OBJECT_ID;

        if (!sourceWalletId) {
            throw new Error(`Sender (${senderAddress}) does not have a Wallet object. A Wallet object is required to transfer funds.`);
        }
        if (!destWalletObjectId) {
            throw new Error(`Recipient (${destWalletId}) does not have a Wallet object. A Wallet object is required to transfer funds.`);
        }

        const txb = new TransactionBlock();
        txb.moveCall({
            target: `${PACKAGE_ID}::${MODULE_NAME}::transfer_to_wallet`,
            arguments: [
                txb.object(sourceWalletId),
                txb.object(destWalletObjectId),
                txb.pure.u64(amount),
            ],
        });


        // Perform dry run to estimate gas
        const dryRunResult = await client.dryRunTransactionBlock({
            transactionBlock: await txb.build({ client }),
        });
        if (dryRunResult.effects.status.status !== 'success') {
            throw new Error(`Dry run failed: ${dryRunResult.effects.status.error || 'Unknown error'}`);
        }
        // Calculate total gas cost (computation + storage) with a 20% buffer
        const gasUsed = dryRunResult.effects.gasUsed;
        const gasBudget = Math.floor(
            (gasUsed.computationCost + gasUsed.storageCost) * 1.2
        );
        // Check balance
        const balance = await checkBalance(senderAddress);
        if (balance < amount + gasBudget) {
            throw new Error(`Insufficient balance for transfer (${amount} MIST) and gas (${gasBudget} MIST)`);
        }
        // Set gas budget on the TransactionBlock
        txb.setGasBudget(gasBudget);


        const result = await executeTransaction(txb, senderKeypair);
        return {
            success: true,
            transactionDigest: result.digest,
            senderAddress,
        };
    } catch (error) {
        console.error('Transfer failed:', error.stack);
        return { success: false, error: `Transfer failed: ${error.message}` };
    }
}


export function getSenderAddress(senderPrivateKey) {
    try {
        const keypair = getKeypairFromPrivateKey(senderPrivateKey);
        return keypair.getPublicKey().toSuiAddress();
    } catch (error) {
        console.error('Failed to derive sender address:', error);
        throw new Error('Invalid private key');
    }
}
