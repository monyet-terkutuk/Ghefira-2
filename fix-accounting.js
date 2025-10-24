// fix-accounting.js - FIXED VERSION
const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from config folder
require('dotenv').config({ path: path.join(__dirname, 'config/.env') });

async function fixAccounting() {
    try {
        console.log('🔧 Loading environment variables...');

        const MONGODB_URI = process.env.MONGODB_URI;

        if (!MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            console.log('💡 Please check your config/.env file');
            console.log('Current working directory:', process.cwd());
            return;
        }

        console.log('✅ MONGODB_URI found');
        console.log('🔗 Connecting to MongoDB...');

        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log('✅ Connected to MongoDB');

        const Account = require('./model/Account');
        const userId = '6884ba24a6a6615113b7a4a5';

        // Get all accounts
        const accounts = await Account.find({ user: userId });

        if (accounts.length === 0) {
            console.log('❌ No accounts found for user');
            return;
        }

        console.log('\n📊 Current Balances:');
        accounts.forEach(acc => {
            console.log(`   ${acc.code} - ${acc.name}: ${acc.balance}`);
        });

        // Calculate total expenses
        const expenseAccounts = accounts.filter(acc => acc.type === 'expense');
        const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);

        console.log(`\n💰 Total Expenses: ${totalExpenses}`);

        // Update Retained Earnings
        let retainedEarnings = await Account.findOne({ code: '302', user: userId });

        if (!retainedEarnings) {
            console.log('❌ Retained Earnings account (302) not found, creating...');
            retainedEarnings = await Account.create({
                name: 'Retained Earnings',
                code: '302',
                type: 'equity',
                normal_balance: 'credit',
                user: userId,
                balance: -totalExpenses
            });
            console.log('✅ Created Retained Earnings account');
        } else {
            retainedEarnings.balance = -totalExpenses; // Negative karena expense mengurangi equity
            await retainedEarnings.save();
            console.log(`✅ Retained Earnings updated to: ${retainedEarnings.balance}`);
        }

        // Verify accounting equation
        const assets = accounts.filter(acc => acc.type === 'asset');
        const liabilities = accounts.filter(acc => acc.type === 'liability');
        const equityAccounts = await Account.find({ user: userId, type: 'equity' });

        const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
        const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
        const totalEquity = equityAccounts.reduce((sum, acc) => sum + acc.balance, 0);

        console.log('\n🧮 Accounting Equation Check:');
        console.log(`   Assets: ${totalAssets}`);
        console.log(`   Liabilities: ${totalLiabilities}`);
        console.log(`   Equity: ${totalEquity}`);
        console.log(`   Liabilities + Equity: ${totalLiabilities + totalEquity}`);
        console.log(`   Equation: Assets (${totalAssets}) = Liabilities (${totalLiabilities}) + Equity (${totalEquity})`);
        console.log(`   Balanced: ${Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01}`);

        // Show final balances
        console.log('\n📈 Final Account Balances:');
        const allAccounts = await Account.find({ user: userId }).sort({ code: 1 });
        allAccounts.forEach(acc => {
            console.log(`   ${acc.code} - ${acc.name}: ${acc.balance} (Type: ${acc.type})`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Fix completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.name === 'MongoServerSelectionError') {
            console.log('💡 Check your MongoDB connection string in config/.env');
        }
    }
}

fixAccounting();