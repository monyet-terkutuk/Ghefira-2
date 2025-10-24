const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const Saldo = new Schema(
    {
        name: {
            type: String,
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
    },
    { timestamps: true }
);

module.exports = model('Saldo', Saldo); 
