require('dotenv').config();
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const driversRouter = require('./routes/drivers');
const driverRouter = require('./routes/driver');
const groupsRouter = require('./routes/groups');

connectDB();

const app = express();
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('Campus Carpool Hub API is running!');
});

app.use('/api/drivers', driversRouter);
app.use('/api/driver', driverRouter);
app.use('/api/groups', groupsRouter);

module.exports = app;