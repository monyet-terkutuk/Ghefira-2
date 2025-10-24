const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
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

// Virtual untuk display balance berdasarkan normal balance
AccountSchema.virtual('display_balance').get(function () {
    if (this.normal_balance === 'debit') {
        return this.balance;
    } else {
        return -this.balance; // Credit balances shown as negative
    }
});

module.exports = mongoose.model("Account", AccountSchema);