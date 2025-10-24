const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    image: String,
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);
