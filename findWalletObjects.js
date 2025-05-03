import { client } from './suiClient.js';

const PACKAGE_ID = process.env.PACKAGE_ID;
const MODULE_NAME = process.env.MODULE_NAME;

async function findWalletObjectId(address) {
    try {
        const objects = await client.getOwnedObjects({
            owner: address,
            options: { showType: true },
        });
        const walletObject = objects.data.find(
            (obj) => obj.data?.type === `${PACKAGE_ID}::${MODULE_NAME}::Wallet`
        );
        if (!walletObject) {
            console.log(`No Wallet object found for address ${address}`);
            return null;
        }
        console.log(`Found Wallet object for ${address}:`, walletObject);
        return walletObject.data.objectId;
    } catch (error) {
        console.error(`Failed to fetch objects for ${address}:`, error);
        throw error;
    }
}

// Example usage
async function main() {
    const senderAddress = '0x52f03ac4ac477f9ec51f0e51b9a6d720a311e3a8c0c11cd8c2eeb9eb44d475e5';
    const recipientAddress = '0xb7cd2f1248678984499a78ee51e14a01d1a9efe4d23f11469c3c29a11e4fdf6f';

    console.log('Finding sender Wallet object...');
    const senderWalletId = await findWalletObjectId(senderAddress);
    console.log(`Sender Wallet Object ID: ${senderWalletId}`);

    console.log('Finding recipient Wallet object...');
    const recipientWalletId = await findWalletObjectId(recipientAddress);
    console.log(`Recipient Wallet Object ID: ${recipientWalletId}`);
}

main().catch(console.error);