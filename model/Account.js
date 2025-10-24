const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['asset', 'liability', 'equity', 'revenue', 'expense']
    },
    normal_balance: {
        type: String,
        required: true,
        enum: ['debit', 'credit']
    },
    balance: { type: Number, default: 0 },
    description: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

// **FIXED: Virtual untuk display balance berdasarkan normal balance**
AccountSchema.virtual('display_balance').get(function () {
    // Untuk balance sheet presentation - selalu positif
    return Math.abs(this.balance);
});

// Virtual untuk accounting equation calculation
AccountSchema.virtual('accounting_balance').get(function () {
    // Untuk accounting equation - sesuai normal balance rules
    if (this.type === 'asset' || this.type === 'expense') {
        return this.balance; // Debit balances positive
    } else {
        return -this.balance; // Credit balances positive
    }
});
// **NEW: Method untuk update balance dengan validation**
AccountSchema.methods.updateBalance = function (debit = 0, credit = 0) {
    console.log(`Updating account ${this.code} (${this.name}): Balance ${this.balance} + Debit:${debit} - Credit:${credit}`);

    if (this.normal_balance === 'debit') {
        // Assets & Expenses: Debit increases, Credit decreases
        this.balance += debit;
        this.balance -= credit;
    } else {
        // Liabilities, Equity, Revenue: Credit increases, Debit decreases  
        this.balance += credit;
        this.balance -= debit;
    }

    console.log(`New balance: ${this.balance}`);
    return this.balance;
};

// Enable virtuals in JSON output
AccountSchema.set('toJSON', { virtuals: true });
AccountSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("Account", AccountSchema);