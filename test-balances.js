const mongoose = require('mongoose');
const Account = require('./model/Account');
const JournalEntry = require('./model/JournalEntry');

async function testBalances() {
    console.log('🧪 Testing Account Balances...');

    // Connect to your database
    await mongoose.connect('your-mongodb-uri');

    const userId = '6884ba24a6a6615113b7a4a5'; // Your user ID

    // Check current balances
    const accounts = await Account.find({ user: userId });
    console.log('\n📊 Current Account Balances:');
    accounts.forEach(acc => {
        console.log(`   ${acc.code} - ${acc.name}: ${acc.balance} (Type: ${acc.type}, Normal: ${acc.normal_balance})`);
    });

    // Check journal entries
    const entries = await JournalEntry.find({ user: userId })
        .populate('entries.account');

    console.log('\n📋 Journal Entries:');
    entries.forEach(entry => {
        console.log(`   ${entry.description} - Status: ${entry.status}`);
        entry.entries.forEach(e => {
            console.log(`     ${e.account.code}: Debit ${e.debit}, Credit ${e.credit}`);
        });
    });

    // Test posting if entry is draft
    const draftEntry = await JournalEntry.findOne({ user: userId, status: 'draft' });
    if (draftEntry) {
        console.log('\n📤 Testing post method...');
        await draftEntry.post();
    }

    mongoose.disconnect();
}

testBalances().catch(console.error);