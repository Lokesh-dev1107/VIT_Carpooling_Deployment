require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Campus Carpool Hub API is running!');
});

// ---------- DB CONNECTION ----------
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('CRITICAL ERROR: Neither MONGODB_URI nor MONGO_URI is set in environment variables!');
} else {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('SUCCESS: Connected to MongoDB Atlas!'))
    .catch((err) => console.error('DB Connection Failed:', err.message));
}

// ---------- CONSTANTS ----------
const FORMING_WINDOW_MS = 10 * 60 * 1000;      // 10 minutes to fill seats
const LEAVE_CUTOFF_MS = 2 * 60 * 60 * 1000;    // members must leave >2hrs before departure
const HOST_CANCEL_CUTOFF_MS = 10 * 60 * 1000;  // host can cancel up until 10 min before departure

// ---------- SCHEMAS ----------
const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contact: { type: String, required: true },
  isHost: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now }
}, { _id: true });

const rideGroupSchema = new mongoose.Schema({
  groupCode: { type: String, required: true, unique: true },
  origin: { type: String, default: 'Campus Main Gate' },
  destination: { type: String, required: true },
  departureTime: { type: Date, required: true },
  totalSeats: { type: Number, required: true, min: 1 },
  costPerSeat: { type: Number, required: true },
  members: { type: [memberSchema], default: [] },
  status: {
    type: String,
    enum: ['FORMING', 'PENDING_DRIVER', 'CONFIRMED', 'EXPIRED', 'CANCELLED'],
    default: 'FORMING'
  },
  formingDeadline: { type: Date, required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
  driverName: { type: String, default: null },
  driverContact: { type: String, default: null }
}, { timestamps: true });

const RideGroup = mongoose.model('RideGroup', rideGroupSchema);

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const Driver = mongoose.model('Driver', driverSchema);

// ---------- HELPERS ----------
function generateGroupCode() {
  // 6-char alphanumeric, easy to read/share
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

// Re-check time-based state transitions whenever a group is touched.
// Keeps status correct without needing a background cron job.
function applyLifecycleRules(group) {
  const now = Date.now();

  if (group.status === 'FORMING' && now > group.formingDeadline.getTime()) {
    group.status = 'EXPIRED';
    return group;
  }

  if (group.status !== 'CANCELLED' && group.status !== 'EXPIRED') {
    if (now > group.departureTime.getTime() - HOST_CANCEL_CUTOFF_MS && group.status !== 'CONFIRMED') {
      // If it never got confirmed and we're inside the host-cancel cutoff, it's effectively dead.
      group.status = 'EXPIRED';
    }
  }

  return group;
}

async function saveWithLifecycle(group) {
  applyLifecycleRules(group);
  await group.save();
  return group;
}

function isFull(group) {
  return group.members.length >= group.totalSeats;
}

function toPublicGroup(group) {
  const obj = group.toObject();
  return obj;
}

// ---------- STUDENT ROUTES ----------

// CREATE: student starts a new ride group (becomes host)
app.post('/api/groups', async (req, res) => {
  try {
    const { destination, departureTime, totalSeats, costPerSeat, hostName, hostContact } = req.body;

    if (!destination || !departureTime || !totalSeats || !costPerSeat || !hostName || !hostContact) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const departure = new Date(departureTime);
    if (isNaN(departure.getTime())) {
      return res.status(400).json({ error: 'Invalid departure time' });
    }
    if (departure.getTime() <= Date.now() + HOST_CANCEL_CUTOFF_MS) {
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

    // A group of size 1 filled immediately (rare, but handle it)
    if (isFull(group)) {
      group.status = 'PENDING_DRIVER';
      await group.save();
    }

    res.status(201).json({ message: 'Ride group created!', group: toPublicGroup(group) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ: all groups visible to students (not cancelled)
app.get('/api/groups', async (req, res) => {
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
app.get('/api/groups/code/:code', async (req, res) => {
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
app.post('/api/groups/:id/join', async (req, res) => {
  try {
    const { name, contact } = req.body;
    if (!name || !contact) return res.status(400).json({ error: 'Name and contact are required' });

    const group = await RideGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    applyLifecycleRules(group);

    if (group.status !== 'FORMING') {
      return res.status(400).json({ error: `Cannot join — group is ${group.status}` });
    }
    if (isFull(group)) {
      return res.status(400).json({ error: 'Group is already full' });
    }

    const alreadyIn = group.members.some(m => m.contact === contact);
    if (alreadyIn) return res.status(400).json({ error: 'You have already joined this group' });

    group.members.push({ name, contact, isHost: false });

    if (isFull(group)) {
      group.status = 'PENDING_DRIVER';
    }

    await group.save();
    res.json({ message: 'Joined group!', group: toPublicGroup(group) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE: a member leaves the group (must be >2hrs before departure)
app.post('/api/groups/:id/leave', async (req, res) => {
  try {
    const { contact } = req.body;
    if (!contact) return res.status(400).json({ error: 'Contact is required to identify member' });

    const group = await RideGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    applyLifecycleRules(group);

    if (['CANCELLED', 'EXPIRED'].includes(group.status)) {
      return res.status(400).json({ error: `Cannot leave — group is ${group.status}` });
    }

    const timeUntilDeparture = group.departureTime.getTime() - Date.now();
    if (timeUntilDeparture < LEAVE_CUTOFF_MS) {
      return res.status(400).json({ error: 'Too late to leave — must be more than 2 hours before departure' });
    }

    const member = group.members.find(m => m.contact === contact);
    if (!member) return res.status(404).json({ error: 'You are not a member of this group' });
    if (member.isHost) {
      return res.status(400).json({ error: 'Host cannot leave — use cancel group instead' });
    }

    group.members = group.members.filter(m => m.contact !== contact);

    // Reopen the group if it had filled and is now short a seat
    if (group.status === 'PENDING_DRIVER' && !isFull(group)) {
      group.status = 'FORMING';
      group.driverId = null;
      group.driverName = null;
      group.driverContact = null;
    } else if (group.status === 'CONFIRMED' && !isFull(group)) {
      group.status = 'FORMING';
      group.driverId = null;
      group.driverName = null;
      group.driverContact = null;
      group.formingDeadline = new Date(Date.now() + FORMING_WINDOW_MS);
    }

    await group.save();
    res.json({ message: 'Left group', group: toPublicGroup(group) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// UPDATE: host cancels the entire group (until 10 min before departure)
app.post('/api/groups/:id/cancel', async (req, res) => {
  try {
    const { hostContact } = req.body;
    if (!hostContact) return res.status(400).json({ error: 'Host contact is required' });

    const group = await RideGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const host = group.members.find(m => m.isHost);
    if (!host || host.contact !== hostContact) {
      return res.status(403).json({ error: 'Only the group host can cancel this ride' });
    }

    const timeUntilDeparture = group.departureTime.getTime() - Date.now();
    if (timeUntilDeparture < HOST_CANCEL_CUTOFF_MS) {
      return res.status(400).json({ error: 'Too late to cancel — less than 10 minutes to departure' });
    }

    group.status = 'CANCELLED';
    await group.save();
    res.json({ message: 'Ride group cancelled', group: toPublicGroup(group) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- DRIVER AUTH ----------

app.post('/api/drivers/signup', async (req, res) => {
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

app.post('/api/drivers/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone and password are required' });

    const driver = await Driver.findOne({ phone });
    if (!driver) return res.status(401).json({ error: 'Invalid phone or password' });

    const valid = await bcrypt.compare(password, driver.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid phone or password' });

    // Simple session token (not JWT) — fine for a course project, not production auth
    res.json({ message: 'Login successful', driver: { id: driver._id, name: driver.name, phone: driver.phone } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- DRIVER ROUTES ----------

// READ: groups ready for a driver to accept
app.get('/api/driver/groups', async (req, res) => {
  try {
    const groups = await RideGroup.find({ status: 'PENDING_DRIVER' }).sort({ departureTime: 1 });
    res.json(groups.map(toPublicGroup));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: driver accepts a group
app.post('/api/groups/:id/accept', async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ error: 'driverId is required' });

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const group = await RideGroup.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    applyLifecycleRules(group);

    if (group.status !== 'PENDING_DRIVER') {
      return res.status(400).json({ error: `Cannot accept — group is ${group.status}` });
    }

    group.status = 'CONFIRMED';
    group.driverId = driver._id;
    group.driverName = driver.name;
    group.driverContact = driver.phone;

    await group.save();
    res.json({ message: 'Ride confirmed!', group: toPublicGroup(group) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
