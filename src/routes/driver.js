const express = require('express');
const RideGroup = require('../models/RideGroup');
const requireDriver = require('../middleware/requireDriver');
const { toPublicGroup, applyLifecycleRules } = require('../utils/lifecycle');

const router = express.Router();

// READ: groups ready for a driver to accept (requires valid driver JWT)
router.get('/groups', requireDriver, async (req, res) => {
  try {
    const groups = await RideGroup.find({ status: { $in: ['PENDING_DRIVER', 'CONFIRMED'] } }).sort({ departureTime: 1 });
    const updated = [];
    for (const g of groups) {
      const before = g.status;
      applyLifecycleRules(g);
      if (g.status !== before) await g.save();
      updated.push(toPublicGroup(g));
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;