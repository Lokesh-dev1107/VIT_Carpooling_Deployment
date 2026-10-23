const express = require('express');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Question 2b Requirement: All admin endpoints require ADMIN role
router.use(requireAuth);
router.use(requireRole('ADMIN'));

// 1. GET ALL DRIVERS (Pending and Verified)
router.get('/drivers', async (req, res) => {
  try {
    const drivers = await User.find({ role: 'DRIVER' }).select('-passwordHash -twoFactorSecret').sort({ createdAt: -1 });
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. VERIFY DRIVER (Sets isVerified to true)
router.patch('/verify-driver/:id', async (req, res) => {
  try {
    const driver = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'DRIVER' },
      { isVerified: true },
      { new: true }
    ).select('-passwordHash -twoFactorSecret');

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json({ message: 'Driver approved and verified', driver });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. RBAC DEMONSTRATION ENDPOINT (For Question 2b testing)
router.patch('/system-check', async (req, res) => {
  res.json({
    status: 'AUTHORIZED',
    message: 'RBAC verification successful: User holds valid ADMIN role.',
    admin: {
      id: req.user.id,
      phone: req.user.phone,
      role: req.user.role
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
