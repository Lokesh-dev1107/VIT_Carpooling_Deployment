const express = require('express');
const RideGroup = require('../models/RideGroup');
const Driver = require('../models/Driver');
const requireDriver = require('../middleware/requireDriver');
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

// CREATE: student starts a new ride group (becomes host)
router.post('/', async (req, res) => {
  try {
    const { destination, departureTime, totalSeats, costPerSeat, hostName, hostContact } = req.body;

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

// READ: all groups visible to students (not cancelled)
router.get('/', async (req, res) => {
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

// READ: single group by code (for joining)
router.get('/code/:code', async (req, res) => {
  try {
    const group = await RideGroup.findOne({ groupCode: req.params.code.toUpperCase() });
    if (!group) return res.status(404).json({ error: 'No group found with that code' });
    await saveWithLifecycle(group);
    res.json(toPublicGroup(group));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: join a group using its code
router.post('/:id/join', async (req, res) => {
  try {
    const { name, contact } = req.body;
    if (!name || !contact) return res.status(400).json({ error: 'Name and contact are required' });

    // Read-first for a good error message, same pattern as accept.
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

// UPDATE: driver accepts a group
router.patch('/:id/driver/accept', requireDriver, async (req, res) => {
  try {
    const driverId = req.driverAuth.driverId;

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

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
        driverId: driver._id,
        driverName: driver.name,
        driverContact: driver.phone
      },
      { new: true } // return the document AFTER the update, not before
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