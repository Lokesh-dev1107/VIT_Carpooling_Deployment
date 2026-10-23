require('dotenv').config();
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const driversRouter = require('./routes/drivers');
const driverRouter = require('./routes/driver');
const groupsRouter = require('./routes/groups');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');

connectDB();

const app = express();
app.use(express.json());
app.use(cors());

// Expose instance identifier for load balancing verification (Question 1)
const INSTANCE_ID = process.env.INSTANCE_ID || 'standalone-instance';
app.use((req, res, next) => {
  res.setHeader('X-Handled-By', INSTANCE_ID);
  next();
});

app.get('/', (req, res) => {
  res.send('Campus Carpool Hub API is running!');
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/driver', driverRouter);
app.use('/api/groups', groupsRouter);

module.exports = app;
