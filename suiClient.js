// suiClient.js
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromHex } from '@mysten/sui/utils';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import * as dotenv from 'dotenv';

dotenv.config();

// Configure the SuiClient with the testnet URL
const client = new SuiClient({
    url: getFullnodeUrl('testnet'),
});

// Load the private key from environment variables and create a keypair
const privateKey = fromHex(process.env.PRIVATE_KEY);
const keypair = Ed25519Keypair.fromSecretKey(privateKey);

// Export the client and keypair
export { client, keypair };
