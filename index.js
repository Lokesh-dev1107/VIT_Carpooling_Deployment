require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware: Allows server to understand incoming JSON and cross-origin requests
app.use(express.json());
app.use(cors());

// 1. CONNECT TO MONGODB ATLAS
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('SUCCESS: Connected to MongoDB Atlas!'))
  .catch((err) => console.error('DB Connection Failed:', err.message));

// 2. RIDE DATA BLUEPRINT (SCHEMA)
const rideSchema = new mongoose.Schema({
  origin: { type: String, default: 'Campus Main Gate' },
  destination: { type: String, required: true },
  departureTime: { type: String, required: true },
  availableSeats: { type: Number, required: true },
  costPerSeat: { type: Number, required: true },
  studentContact: { type: String, required: true },
  driverContact: { type: String, default: null },
  status: { type: String, enum: ['OPEN', 'ACCEPTED', 'CANCELLED'], default: 'OPEN' }
}, { timestamps: true });

const Ride = mongoose.model('Ride', rideSchema);

// 3. API ENDPOINTS (CRUD OPERATIONS)

// CREATE: Student posts a new ride request
app.post('/api/rides', async (req, res) => {
  try {
    const newRide = await Ride.create(req.body);
    res.status(201).json({ message: 'Ride created successfully!', ride: newRide });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ: Fetch ALL active rides (open + accepted) — frontend splits them for display.
// FIX: previously filtered to status: 'OPEN' only, so accepted rides vanished
// from the response the moment they were accepted, making "accept" look broken.
app.get('/api/rides', async (req, res) => {
  try {
    const rides = await Ride.find({ status: { $ne: 'CANCELLED' } }).sort({ createdAt: -1 });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE: Driver accepts a ride request
app.put('/api/rides/:id/accept', async (req, res) => {
  try {
    const { driverContact } = req.body;
    if (!driverContact) {
      return res.status(400).json({ error: 'Driver contact number is required' });
    }

    const updatedRide = await Ride.findByIdAndUpdate(
      req.params.id,
      { status: 'ACCEPTED', driverContact: driverContact },
      { new: true }
    );

    if (!updatedRide) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    res.json({ message: 'Ride accepted by driver!', ride: updatedRide });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE: Student cancels a ride request
app.delete('/api/rides/:id', async (req, res) => {
  try {
    const deletedRide = await Ride.findByIdAndDelete(req.params.id);
    if (!deletedRide) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    res.json({ message: 'Ride request cancelled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// START SERVER
const PORT = 5001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));