const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Driver = require('../models/Driver');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone, and password are required' });
    }

    const existing = await Driver.findOne({ phone });
    if (existing) return res.status(400).json({ error: 'A driver with this phone number already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const driver = await Driver.create({ name, phone, passwordHash });

    res.status(201).json({ message: 'Driver account created', driver: { id: driver._id, name: driver.name, phone: driver.phone } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone and password are required' });

    const driver = await Driver.findOne({ phone });
    if (!driver) return res.status(401).json({ error: 'Invalid phone or password' });

    const valid = await bcrypt.compare(password, driver.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid phone or password' });

    const token = jwt.sign(
      { driverId: driver._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Login successful', token, driver: { id: driver._id, name: driver.name, phone: driver.phone } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;