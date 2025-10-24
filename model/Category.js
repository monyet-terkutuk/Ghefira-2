const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const categorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['income', 'expense'],
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

module.exports = model('Category', categorySchema);
