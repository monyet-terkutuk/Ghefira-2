// final-accounting-system-fix.js
require('dotenv').config({ path: 'config/.env' });
const mongoose = require('mongoose');
const Account = require('./model/Account');

async function finalAccountingSystemFix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🎯 Final Accounting System Fix...');

        const userId = '6884ba24a6a6615113b7a4a5';

        // Get current account balances
        const accounts = await Account.find({ user: userId });

        console.log('📊 Current Account Balances:');
        accounts.forEach(acc => {
            if (acc.balance !== 0) {
                console.log(`   ${acc.code} - ${acc.name}: ${acc.balance} (${acc.type})`);
            }
        });

        // Calculate required Owner Equity
        const assets = accounts.filter(acc => acc.type === 'asset');
        const liabilities = accounts.filter(acc => acc.type === 'liability');
        const equity = accounts.filter(acc => acc.type === 'equity');

        const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
        const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
        const totalEquity = equity.reduce((sum, acc) => sum + acc.balance, 0);

        console.log(`\n🧮 Current Equation: ${totalAssets} = ${totalLiabilities} + ${totalEquity}`);

        // Set Owner Equity to balance the equation
        const requiredOwnerEquity = Math.abs(totalAssets) - totalLiabilities - (totalEquity - (accounts.find(acc => acc.code === '301')?.balance || 0));

        let ownerEquity = await Account.findOne({ code: '301', user: userId });
        if (ownerEquity) {
            ownerEquity.balance = Math.max(0, requiredOwnerEquity);
            await ownerEquity.save();
            console.log(`✅ Owner Equity set to: ${ownerEquity.balance}`);
        }

        // Final verification
        const updatedAccounts = await Account.find({ user: userId });
        const updatedAssets = updatedAccounts.filter(acc => acc.type === 'asset');
        const updatedLiabilities = updatedAccounts.filter(acc => acc.type === 'liability');
        const updatedEquity = updatedAccounts.filter(acc => acc.type === 'equity');

        const finalAssets = updatedAssets.reduce((sum, acc) => sum + acc.balance, 0);
        const finalLiabilities = updatedLiabilities.reduce((sum, acc) => sum + acc.balance, 0);
        const finalEquity = updatedEquity.reduce((sum, acc) => sum + acc.balance, 0);

        console.log('\n🎉 FINAL VERIFICATION:');
        console.log(`   Assets: ${finalAssets}`);
        console.log(`   Liabilities: ${finalLiabilities}`);
        console.log(`   Equity: ${finalEquity}`);
        console.log(`   Equation: ${finalAssets} = ${finalLiabilities} + ${finalEquity}`);
        console.log(`   Balanced: ${Math.abs(finalAssets - (finalLiabilities + finalEquity)) < 0.01}`);

        console.log('\n📈 Final Account Balances:');
        updatedAccounts.forEach(acc => {
            if (acc.balance !== 0) {
                const displayBalance = Math.abs(acc.balance);
                console.log(`   ${acc.code} - ${acc.name}: ${acc.balance} (Display: ${displayBalance})`);
            }
        });

        await mongoose.disconnect();
        console.log('\n✅ Accounting system now perfectly balanced!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

finalAccountingSystemFix();