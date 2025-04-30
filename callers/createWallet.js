import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

// Create Wallet with a new keypair for each user
export function createWallet() {

    const keypair = Ed25519Keypair.generate();

    const walletAddress = keypair.getPublicKey().toSuiAddress();

    const privateKey = keypair.getSecretKey();

    return {
        walletAddress,
        privateKey,
    };
}
