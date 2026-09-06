const mongoose = require('mongoose');
const crypto = require('crypto');

const memberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contact: { type: String, required: true },
  isHost: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
  memberToken: { type: String, default: () => crypto.randomBytes(16).toString('hex') }
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

module.exports = RideGroup;