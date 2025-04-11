import express from 'express';
import { createWallet } from './helpers/walletMethods.js';

const app = express();
app.use(express.json());


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


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));