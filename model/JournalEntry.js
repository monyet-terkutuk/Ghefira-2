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
        default: 'posted'
    },
    predicted_category: String, // Hasil prediksi Naive Bayes
    actual_category: String, // Jika user mengkoreksi
    ml_confidence: Number // Confidence score dari model
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

// Update account balances ketika journal dipost
JournalEntrySchema.methods.post = async function () {
    if (this.status !== 'posted') {
        for (const entry of this.entries) {
            const account = await mongoose.model('Account').findById(entry.account);

            if (entry.debit > 0) {
                account.balance += entry.debit;
            } else if (entry.credit > 0) {
                account.balance -= entry.credit;
            }

            await account.save();
        }
        this.status = 'posted';
        await this.save();
    }
};

module.exports = mongoose.model("JournalEntry", JournalEntrySchema);