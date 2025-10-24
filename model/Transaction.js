const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const transactionSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            required: true,
        },
        saldo: {
            type: Schema.Types.ObjectId,
            ref: 'Saldo',
            required: true,
        },
        amount: {
            type: Number,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['income', 'expense'],
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = model('Transaction', transactionSchema);
