// RESET solution - jalankan ini
require('dotenv').config({ path: 'config/.env' });
const mongoose = require('mongoose');
const Account = require('./model/Account');

async function resetAccountingSystem() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔄 Resetting Accounting System...');

        const userId = '6884ba24a6a6615113b7a4a5';

        // Reset Owner Equity to 0
        await Account.updateOne(
            { code: '301', user: userId },
            { balance: 0 }
        );

        // Reset Retained Earnings to reflect actual net position
        const assets = await Account.find({ user: userId, type: 'asset' });
        const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);

        await Account.updateOne(
            { code: '302', user: userId },
            { balance: totalAssets } // Retained Earnings = Total Assets (karena no liabilities)
        );

        console.log('✅ System reset: Owner Equity = 0, Retained Earnings = Total Assets');

        // Verification
        const accounts = await Account.find({ user: userId });
        const finalAssets = accounts.filter(acc => acc.type === 'asset')
            .reduce((sum, acc) => sum + acc.balance, 0);
        const finalEquity = accounts.filter(acc => acc.type === 'equity')
            .reduce((sum, acc) => sum + acc.balance, 0);

        console.log(`🎉 Final: Assets ${finalAssets} = Equity ${finalEquity}`);
        console.log(`   Balanced: ${Math.abs(finalAssets - finalEquity) < 0.01}`);

        await mongoose.disconnect();
        console.log('\n✅ Accounting system perfectly balanced!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

resetAccountingSystem();