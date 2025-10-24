const mongoose = require("mongoose");

const JournalEntrySchema = new mongoose.Schema({
    transaction_date: { type: Date, required: true, default: Date.now },
    reference: String,
    description: { type: String, required: true },
    entries: [{
        account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
        debit: { type: Number, default: 0 },
        credit: { type: Number, default: 0 },
        description: String
    }],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        enum: ['draft', 'posted', 'cancelled'],
        default: 'draft'
    },
    predicted_category: String,
    actual_category: String,
    ml_confidence: Number
}, { timestamps: true });

// Validation: Total debit harus sama dengan total credit
JournalEntrySchema.pre('save', function (next) {
    const totalDebit = this.entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredit = this.entries.reduce((sum, entry) => sum + entry.credit, 0);

    if (totalDebit !== totalCredit) {
        return next(new Error(`Unbalanced journal entry: Debit ${totalDebit} ≠ Credit ${totalCredit}`));
    }
    next();
});

// ✅ NEW: Method untuk auto-update Retained Earnings
JournalEntrySchema.methods.updateRetainedEarnings = async function () {
    const userId = this.user;

    // Get Retained Earnings account
    let retainedEarnings = await mongoose.model('Account').findOne({
        code: '302',
        user: userId
    });

    // Create if not exists
    if (!retainedEarnings) {
        retainedEarnings = await mongoose.model('Account').create({
            name: 'Retained Earnings',
            code: '302',
            type: 'equity',
            normal_balance: 'credit',
            user: userId,
            balance: 0
        });
        console.log('✅ Created Retained Earnings account');
    }

    // Calculate net effect of this transaction
    let netEffect = 0;

    for (const entry of this.entries) {
        const account = await mongoose.model('Account').findById(entry.account);

        if (account.type === 'revenue') {
            netEffect += entry.credit; // Revenue increases retained earnings
        } else if (account.type === 'expense') {
            netEffect -= entry.debit; // Expense decreases retained earnings
        }
    }

    if (netEffect !== 0) {
        console.log(`📊 Updating Retained Earnings: ${netEffect > 0 ? '+' : ''}${netEffect}`);
        console.log(`   Before RE: ${retainedEarnings.balance}`);

        retainedEarnings.balance += netEffect;
        await retainedEarnings.save();

        console.log(`   After RE: ${retainedEarnings.balance}`);
    }
};

// ✅ NEW: Method untuk auto-adjust Owner Equity
JournalEntrySchema.methods.autoAdjustOwnerEquity = async function () {
    const userId = this.user;

    // Get Owner Equity account
    let ownerEquity = await mongoose.model('Account').findOne({
        code: '301',
        user: userId
    });

    if (!ownerEquity) {
        ownerEquity = await mongoose.model('Account').create({
            name: 'Owner Equity',
            code: '301',
            type: 'equity',
            normal_balance: 'credit',
            user: userId,
            balance: 0
        });
        console.log('✅ Created Owner Equity account');
    }

    // Get all accounts untuk calculate accounting equation
    const accounts = await mongoose.model('Account').find({ user: userId });

    const assets = accounts.filter(acc => acc.type === 'asset');
    const liabilities = accounts.filter(acc => acc.type === 'liability');
    const otherEquity = accounts.filter(acc => acc.type === 'equity' && acc.code !== '301');

    const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
    const totalOtherEquity = otherEquity.reduce((sum, acc) => sum + acc.balance, 0);

    // Accounting Equation: Assets = Liabilities + Equity
    // Required Owner Equity = Assets - Liabilities - Other Equity
    const requiredOwnerEquity = totalAssets - totalLiabilities - totalOtherEquity;

    console.log(`🔄 Auto-adjusting Owner Equity:`);
    console.log(`   Assets: ${totalAssets}, Liabilities: ${totalLiabilities}, Other Equity: ${totalOtherEquity}`);
    console.log(`   Required Owner Equity: ${requiredOwnerEquity}`);
    console.log(`   Current Owner Equity: ${ownerEquity.balance}`);

    if (ownerEquity.balance !== requiredOwnerEquity) {
        ownerEquity.balance = requiredOwnerEquity;
        await ownerEquity.save();
        console.log(`✅ Owner Equity adjusted to: ${ownerEquity.balance}`);
    }
};

// ✅ NEW: Reverse Owner Equity adjustment
JournalEntrySchema.methods.reverseOwnerEquity = async function () {
    // When reversing, we need to re-calculate Owner Equity
    await this.autoAdjustOwnerEquity();
};

// ✅ NEW: Reverse Retained Earnings
JournalEntrySchema.methods.reverseRetainedEarnings = async function () {
    const userId = this.user;
    const retainedEarnings = await mongoose.model('Account').findOne({
        code: '302',
        user: userId
    });

    if (!retainedEarnings) return;

    // Calculate net effect and reverse it
    let netEffect = 0;

    for (const entry of this.entries) {
        const account = await mongoose.model('Account').findById(entry.account);

        if (account.type === 'revenue') {
            netEffect += entry.credit;
        } else if (account.type === 'expense') {
            netEffect -= entry.debit;
        }
    }

    if (netEffect !== 0) {
        console.log(`🔄 Reversing Retained Earnings: ${-netEffect}`);
        console.log(`   Before RE: ${retainedEarnings.balance}`);

        retainedEarnings.balance -= netEffect; // Reverse the effect
        await retainedEarnings.save();

        console.log(`   After RE: ${retainedEarnings.balance}`);
    }
};

// **FIXED: Update account balances ketika journal dipost + Auto Retained Earnings + Auto Owner Equity**
JournalEntrySchema.methods.post = async function () {
    if (this.status !== 'posted') {
        console.log(`📤 Posting journal entry: ${this.description}`);

        for (const entry of this.entries) {
            const account = await mongoose.model('Account').findById(entry.account);

            if (!account) {
                throw new Error(`Account not found: ${entry.account}`);
            }

            console.log(`   Before - Account ${account.code} (${account.name}): ${account.balance}`);

            if (entry.debit > 0) {
                account.balance += entry.debit;
                console.log(`   + Debit: ${entry.debit}`);
            }
            if (entry.credit > 0) {
                account.balance -= entry.credit;
                console.log(`   - Credit: ${entry.credit}`);
            }

            await account.save();
            console.log(`   After - Account ${account.code} (${account.name}): ${account.balance}`);
        }

        // ✅ AUTO-UPDATE RETAINED EARNINGS
        await this.updateRetainedEarnings();

        // ✅ NEW: AUTO-ADJUST OWNER EQUITY
        await this.autoAdjustOwnerEquity();

        this.status = 'posted';
        await this.save();
        console.log('✅ Journal entry posted successfully');
    }
};

// **NEW: Method untuk reverse balances (saat cancel) + Reverse Retained Earnings + Reverse Owner Equity**
JournalEntrySchema.methods.reverse = async function () {
    if (this.status === 'posted') {
        console.log(`🔄 Reversing journal entry: ${this.description}`);

        for (const entry of this.entries) {
            const account = await mongoose.model('Account').findById(entry.account);

            if (!account) {
                throw new Error(`Account not found: ${entry.account}`);
            }

            console.log(`   Before Reverse - Account ${account.code}: ${account.balance}`);

            if (entry.debit > 0) {
                account.balance -= entry.debit;
                console.log(`   - Reverse Debit: ${entry.debit}`);
            }
            if (entry.credit > 0) {
                account.balance += entry.credit;
                console.log(`   + Reverse Credit: ${entry.credit}`);
            }

            await account.save();
            console.log(`   After Reverse - Account ${account.code}: ${account.balance}`);
        }

        // ✅ REVERSE RETAINED EARNINGS TOO
        await this.reverseRetainedEarnings();

        // ✅ NEW: RE-ADJUST OWNER EQUITY
        await this.reverseOwnerEquity();

        this.status = 'cancelled';
        await this.save();
        console.log('✅ Journal entry reversed successfully');
    }
};

module.exports = mongoose.model("JournalEntry", JournalEntrySchema);