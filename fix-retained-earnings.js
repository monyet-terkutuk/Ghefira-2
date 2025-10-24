// fix-retained-earnings.js
require('dotenv').config({ path: 'config/.env' });
const mongoose = require('mongoose');
const Account = require('./model/Account');
const JournalEntry = require('./model/JournalEntry');

async function fixRetainedEarnings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const userId = '6884ba24a6a6615113b7a4a5';

        // Get all posted journal entries
        const postedEntries = await JournalEntry.find({
            user: userId,
            status: 'posted'
        }).populate('entries.account');

        // Calculate total revenue and expenses
        let totalRevenue = 0;
        let totalExpenses = 0;

        for (const entry of postedEntries) {
            for (const journalEntry of entry.entries) {
                const account = journalEntry.account;

                if (account.type === 'revenue') {
                    totalRevenue += journalEntry.credit;
                } else if (account.type === 'expense') {
                    totalExpenses += journalEntry.debit;
                }
            }
        }

        const netIncome = totalRevenue - totalExpenses;

        console.log(`📊 Total Revenue: ${totalRevenue}`);
        console.log(`📊 Total Expenses: ${totalExpenses}`);
        console.log(`📊 Net Income: ${netIncome}`);

        // Update Retained Earnings
        let retainedEarnings = await Account.findOne({ code: '302', user: userId });
        if (!retainedEarnings) {
            retainedEarnings = await Account.create({
                name: 'Retained Earnings',
                code: '302',
                type: 'equity',
                normal_balance: 'credit',
                user: userId,
                balance: netIncome
            });
            console.log('✅ Created Retained Earnings account');
        } else {
            retainedEarnings.balance = netIncome;
            await retainedEarnings.save();
            console.log(`✅ Retained Earnings updated to: ${retainedEarnings.balance}`);
        }

        // Verify
        const accounts = await Account.find({ user: userId });
        console.log('\n📈 Final Balances:');
        accounts.forEach(acc => {
            console.log(`   ${acc.code} - ${acc.name}: ${acc.balance}`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Fix completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixRetainedEarnings();