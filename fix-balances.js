require('dotenv').config(); // Load environment variables
const mongoose = require('mongoose');
const Account = require('./model/Account');
const JournalEntry = require('./model/JournalEntry');

async function fixBalances() {
    try {
        // Gunakan connection string dari environment variables sama seperti app.js
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database';

        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const userId = '6884ba24a6a6615113b7a4a5'; // Your user ID

        // Reset all balances to 0
        console.log('🔄 Resetting all account balances to 0...');
        await Account.updateMany({ user: userId }, { balance: 0 });
        console.log('✅ Reset all account balances to 0');

        // Get all posted journal entries
        const entries = await JournalEntry.find({
            user: userId,
            status: 'posted'
        }).populate('entries.account');

        console.log(`\n📊 Found ${entries.length} posted journal entries`);

        // Recalculate balances from journal entries
        for (const entry of entries) {
            console.log(`\n📝 Processing: "${entry.description}"`);

            for (const journalEntry of entry.entries) {
                const account = journalEntry.account;

                console.log(`   💰 Account ${account.code} (${account.name}):`);
                console.log(`      Before: ${account.balance}`);
                console.log(`      Transaction: Debit ${journalEntry.debit}, Credit ${journalEntry.credit}`);

                if (account.normal_balance === 'debit') {
                    // Assets & Expenses: Debit increases, Credit decreases
                    account.balance += journalEntry.debit;
                    account.balance -= journalEntry.credit;
                } else {
                    // Liabilities, Equity, Revenue: Credit increases, Debit decreases  
                    account.balance += journalEntry.credit;
                    account.balance -= journalEntry.debit;
                }

                await account.save();
                console.log(`      After: ${account.balance}`);
            }
        }

        console.log('\n✅ All balances updated successfully!');

        // Verify final balances
        const finalAccounts = await Account.find({ user: userId }).sort({ code: 1 });
        console.log('\n📊 Final Account Balances:');
        console.log('='.repeat(50));

        finalAccounts.forEach(acc => {
            console.log(`   ${acc.code} - ${acc.name.padEnd(25)}: ${acc.balance.toLocaleString()}`);
        });

        // Calculate totals by type
        const assets = finalAccounts.filter(acc => acc.type === 'asset');
        const liabilities = finalAccounts.filter(acc => acc.type === 'liability');
        const equity = finalAccounts.filter(acc => acc.type === 'equity');
        const revenue = finalAccounts.filter(acc => acc.type === 'revenue');
        const expenses = finalAccounts.filter(acc => acc.type === 'expense');

        const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
        const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
        const totalEquity = equity.reduce((sum, acc) => sum + acc.balance, 0);
        const totalRevenue = revenue.reduce((sum, acc) => sum + acc.balance, 0);
        const totalExpenses = expenses.reduce((sum, acc) => sum + acc.balance, 0);

        console.log('\n📈 Summary by Account Type:');
        console.log('='.repeat(50));
        console.log(`   Assets:     ${totalAssets.toLocaleString()}`);
        console.log(`   Liabilities: ${totalLiabilities.toLocaleString()}`);
        console.log(`   Equity:     ${totalEquity.toLocaleString()}`);
        console.log(`   Revenue:    ${totalRevenue.toLocaleString()}`);
        console.log(`   Expenses:   ${totalExpenses.toLocaleString()}`);

        // Check accounting equation
        const netIncome = totalRevenue - totalExpenses;
        const accountingEquation = totalAssets - (totalLiabilities + totalEquity + netIncome);

        console.log('\n🧮 Accounting Equation Check:');
        console.log('='.repeat(50));
        console.log(`   Assets = Liabilities + Equity + (Revenue - Expenses)`);
        console.log(`   ${totalAssets} = ${totalLiabilities} + ${totalEquity} + (${totalRevenue} - ${totalExpenses})`);
        console.log(`   ${totalAssets} = ${totalLiabilities + totalEquity + netIncome}`);
        console.log(`   Difference: ${accountingEquation}`);
        console.log(`   ✅ Balanced: ${Math.abs(accountingEquation) < 0.01}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the function
fixBalances();