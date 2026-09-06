const express = require('express');
const RideGroup = require('../models/RideGroup');
const { toPublicGroup } = require('../utils/lifecycle');

const router = express.Router();

// READ: groups ready for a driver to accept
router.get('/groups', async (req, res) => {
  try {
    const groups = await RideGroup.find({ status: 'PENDING_DRIVER' }).sort({ departureTime: 1 });
    res.json(groups.map(toPublicGroup));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;