const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 1. REGISTER USER (Salted Password Hashing via bcrypt)
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone, and password are required' });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ error: 'An account with this phone number already exists' });
    }

    // Question 2a Requirement: Salted hash generation (10 salt rounds)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const validRole = ['STUDENT', 'DRIVER', 'ADMIN'].includes(role) ? role : 'STUDENT';
    const user = await User.create({
      name,
      phone,
      passwordHash,
      role: validRole
    });

    res.status(201).json({
      message: 'Account registered successfully',
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. LOGIN (With optional TOTP Multi-Factor Step)
router.post('/login', async (req, res) => {
  try {
    const { phone, password, totpCode } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }

    // Question 2b Requirement: TOTP Multi-Factor Authentication
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        return res.status(206).json({
          mfaRequired: true,
          message: 'Two-Factor Authentication code required'
        });
      }

      const isValidToken = authenticator.check(totpCode, user.twoFactorSecret);
      if (!isValidToken) {
        return res.status(401).json({ error: 'Invalid 6-digit Authenticator code' });
      }
    }

    const token = jwt.sign(
      { id: user._id, phone: user.phone, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. START MFA SETUP (Generates secret and QR Code URI)
router.get('/mfa/setup', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.phone, 'Campus Carpool', secret);

    res.json({ secret, otpauthUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. VERIFY & ACTIVATE MFA
router.post('/mfa/verify-setup', requireAuth, async (req, res) => {
  try {
    const { secret, code } = req.body;
    if (!secret || !code) {
      return res.status(400).json({ error: 'Secret and 6-digit code are required' });
    }

    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your authenticator app.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { twoFactorSecret: secret, twoFactorEnabled: true },
      { new: true }
    );

    res.json({
      message: 'Multi-Factor Authentication enabled successfully!',
      twoFactorEnabled: user.twoFactorEnabled
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
