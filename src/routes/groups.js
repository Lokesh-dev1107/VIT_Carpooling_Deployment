const express = require('express');
const RideGroup = require('../models/RideGroup');
const Driver = require('../models/Driver');
const User = require('../models/User');
const requireDriver = require('../middleware/requireDriver');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  FORMING_WINDOW_MS,
  LEAVE_CUTOFF_MS,
  MIN_LEAD_TIME_MS,
  HOST_CANCEL_CUTOFF_MS,
  generateGroupCode,
  findMemberByToken,
  applyLifecycleRules,
  saveWithLifecycle,
  isFull,
  toPublicGroup
} = require('../utils/lifecycle');

const router = express.Router();

// CREATE: student starts a new ride group (requires authenticated user)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { destination, departureTime, totalSeats, costPerSeat } = req.body;
    const hostName = req.user.name || req.body.hostName;
    const hostContact = req.user.phone || req.body.hostContact;

    if (!destination || !departureTime || !totalSeats || !costPerSeat || !hostName || !hostContact) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (Number(totalSeats) < 1 || Number(totalSeats) > 6) {
      return res.status(400).json({ error: 'Seats must be between 1 and 6' });
    }
    if (Number(costPerSeat) <= 0) {
      return res.status(400).json({ error: 'Cost per seat must be greater than 0' });
    }
    if (!/^[0-9+\-\s()]{7,20}$/.test(hostContact)) {
      return res.status(400).json({ error: 'Enter a valid contact number' });
    }

    const departure = new Date(departureTime);
    if (isNaN(departure.getTime())) {
      return res.status(400).json({ error: 'Invalid departure time' });
    }
    if (departure.getTime() <= Date.now() + MIN_LEAD_TIME_MS) {
      return res.status(400).json({ error: 'Departure time must be at least 10 minutes from now' });
    }

    let groupCode;
    let exists = true;
    while (exists) {
      groupCode = generateGroupCode();
      exists = await RideGroup.findOne({ groupCode });
    }

    const group = await RideGroup.create({
      groupCode,
      destination,
      departureTime: departure,
      totalSeats: Number(totalSeats),
      costPerSeat: Number(costPerSeat),
      formingDeadline: new Date(Date.now() + FORMING_WINDOW_MS),
      members: [{ name: hostName, contact: hostContact, isHost: true }],
      status: 'FORMING'
    });

    if (isFull(group)) {
      group.status = 'PENDING_DRIVER';
      await group.save();
    }

    const hostMember = group.members[0];
    req.app.get('io').emit('groups:changed');
    res.status(201).json({
      message: 'Ride group created!',
      group: toPublicGroup(group),
      memberToken: hostMember.memberToken
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ: aggregate platform activity metrics (public for landing page)
router.get('/stats', async (req, res) => {
  try {
    const byDestination = await RideGroup.aggregate([
      { $group: {
          _id: "$destination",
          rides: { $sum: 1 },
          avgSeats: { $avg: "$totalSeats" },
          avgCost: { $avg: "$costPerSeat" }
      }},
      { $sort: { rides: -1 } },
      { $limit: 10 }
    ]);

    const [overall] = await RideGroup.aggregate([
      { $group: {
          _id: null,
          totalRides: { $sum: 1 },
          totalSeatsOffered: { $sum: "$totalSeats" },
          totalSeatsFilled: { $sum: { $size: "$members" } },
          avgCostPerSeat: { $avg: "$costPerSeat" }
      }}
    ]);

    const byStatus = await RideGroup.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await RideGroup.countDocuments({ createdAt: { $gte: oneDayAgo } });

    res.json({ byDestination, byStatus, overall: overall || {}, recentCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ: all active groups (Protected: Requires Authenticated Campus User)
router.get('/', requireAuth, async (req, res) => {
  try {
    const groups = await RideGroup.find({ status: { $ne: 'CANCELLED' } }).sort({ createdAt: -1 });
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

// READ: single group by code (Protected: Requires Authenticated Campus User)
router.get('/code/:code', requireAuth, async (req, res) => {
  try {
    const group = await RideGroup.findOne({ groupCode: req.params.code.toUpperCase() });
    if (!group) return res.status(404).json({ error: 'No group found with that code' });
    await saveWithLifecycle(group);
    res.json(toPublicGroup(group));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: join a group using its code (Protected: Requires Authenticated Campus User)
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const name = req.user.name || req.body.name;
    const contact = req.user.phone || req.body.contact;
    if (!name || !contact) return res.status(400).json({ error: 'Name and contact are required' });

    const existing = await RideGroup.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Group not found' });
    await saveWithLifecycle(existing);

    if (existing.status !== 'FORMING') {
      return res.status(400).json({ error: `Cannot join — group is ${existing.status}` });
    }
    if (isFull(existing)) {
      return res.status(400).json({ error: 'Group is already full' });
    }
    const alreadyIn = existing.members.some(m => m.contact === contact);
    if (alreadyIn) return res.status(400).json({ error: 'You have already joined this group' });

    const newMemberData = { name, contact, isHost: false };

    // Atomic claim of a seat: 
    const group = await RideGroup.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'FORMING',
        $expr: { $lt: [{ $size: '$members' }, '$totalSeats'] }
      },
      { $push: { members: newMemberData } },
      { new: true }
    );

    if (!group) {
      return res.status(409).json({ error: 'Seat was just taken by someone else — group is now full' });
    }
    if (isFull(group) && group.status === 'FORMING') {
      group.status = 'PENDING_DRIVER';
      await group.save();
    }

    const newMember = group.members[group.members.length - 1];
    req.app.get('io').emit('groups:changed');
    res.json({
      message: 'Joined group!',
      group: toPublicGroup(group),
      memberToken: newMember.memberToken
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE: a member leaves the group (must be >2hrs before departure)
router.delete('/:id/members/me', async (req, res) => {
  try {
    const { memberToken } = req.body;
    if (!memberToken) return res.status(400).json({ error: 'memberToken is required' });

    const group = await RideGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    applyLifecycleRules(group);

    if (['CANCELLED', 'EXPIRED', 'CONFIRMED'].includes(group.status)) {
      const reason = group.status === 'CONFIRMED'
        ? 'A driver has already been confirmed for this ride — contact your host directly, or cancel the whole ride if plans changed.'
        : `Cannot leave — group is ${group.status}`;
      return res.status(400).json({ error: reason });
    }

    const timeUntilDeparture = group.departureTime.getTime() - Date.now();
    if (timeUntilDeparture < LEAVE_CUTOFF_MS) {
      return res.status(400).json({ error: 'Too late to leave — must be more than 2 hours before departure' });
    }

    const member = findMemberByToken(group, memberToken);
    if (!member) return res.status(404).json({ error: 'Invalid member token' });
    if (member.isHost) {
      return res.status(400).json({ error: 'Host cannot leave — use cancel group instead' });
    }

    group.members = group.members.filter(m => m.memberToken !== memberToken);

    if (group.status === 'PENDING_DRIVER' && !isFull(group)) {
      group.status = 'FORMING';
      group.driverId = null;
      group.driverName = null;
      group.driverContact = null;
    } 

    await group.save();
    req.app.get('io').emit('groups:changed');
    res.json({ message: 'Left group', group: toPublicGroup(group) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE: host cancels the entire group (until 10 min before departure)
router.delete('/:id/cancel', async (req, res) => {
  try {
    const { memberToken } = req.body;
    if (!memberToken) return res.status(400).json({ error: 'memberToken is required' });

    const group = await RideGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const host = group.members.find(m => m.isHost);
    if (!host || host.memberToken !== memberToken) {
      return res.status(403).json({ error: 'Only the group host can cancel this ride' });
    }

    const timeUntilDeparture = group.departureTime.getTime() - Date.now();
    if (timeUntilDeparture < HOST_CANCEL_CUTOFF_MS) {
      return res.status(400).json({ error: 'Too late to cancel — less than 10 minutes to departure' });
    }

    group.status = 'CANCELLED';
    await group.save();
    req.app.get('io').emit('groups:changed');
    res.json({ message: 'Ride group cancelled', group: toPublicGroup(group) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE (RBAC Protected): Cancel ride with JWT authentication (Host or Admin only)
router.delete('/:id/cancel-auth', requireAuth, async (req, res) => {
  try {
    const group = await RideGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const host = group.members.find(m => m.isHost);
    
    // Strict phone normalization to ensure accurate host matching
    const normalize = (p) => (p || '').replace(/\D/g, '').slice(-10);
    const hostPhone = host ? normalize(host.contact) : '';
    const userPhone = req.user ? normalize(req.user.phone) : '';

    const isHost = Boolean(hostPhone && userPhone && hostPhone === userPhone);
    const isAdmin = Boolean(req.user && req.user.role === 'ADMIN');

    if (!isHost && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Only the verified group host or a transport administrator can cancel this carpool' });
    }

    group.status = 'CANCELLED';
    await group.save();
    req.app.get('io').emit('groups:changed');
    res.json({ message: 'Ride group cancelled successfully', group: toPublicGroup(group) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE: driver accepts a group (Requires verified driver account)
router.patch('/:id/driver/accept', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'DRIVER') {
      return res.status(403).json({ error: 'Forbidden: Only registered drivers can accept ride requests' });
    }

    // Check verification status in User model
    const driverUser = await User.findById(req.user.id);
    if (!driverUser || !driverUser.isVerified) {
      return res.status(403).json({
        error: 'Forbidden: Your driver account is awaiting verification by campus transport admin.'
      });
    }

    const existing = await RideGroup.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Group not found' });

    applyLifecycleRules(existing);

    if (existing.status !== 'PENDING_DRIVER') {
      return res.status(400).json({ error: `Cannot accept — group is ${existing.status}` });
    }

    const group = await RideGroup.findOneAndUpdate(
      { _id: req.params.id, status: 'PENDING_DRIVER' },
      {
        status: 'CONFIRMED',
        driverId: driverUser._id,
        driverName: driverUser.name,
        driverContact: driverUser.phone
      },
      { new: true }
    );
    if (!group) {
      return res.status(409).json({ error: 'This ride was just claimed by another driver' });
    }
    req.app.get('io').emit('groups:changed');
    res.json({ message: 'Ride confirmed!', group: toPublicGroup(group) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
