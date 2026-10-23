const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['STUDENT', 'DRIVER', 'ADMIN'],
    default: 'STUDENT'
  },
  isVerified: {
    type: Boolean,
    default: function() {
      // Students and Admins default to verified; Drivers require admin approval
      return this.role !== 'DRIVER';
    }
  },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
