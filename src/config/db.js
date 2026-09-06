const mongoose = require('mongoose');

function connectDB() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error('CRITICAL ERROR: Neither MONGODB_URI nor MONGO_URI is set in environment variables!');
    return;
  }

  mongoose.connect(MONGO_URI)
    .then(() => console.log('SUCCESS: Connected to MongoDB Atlas!'))
    .catch((err) => console.error('DB Connection Failed:', err.message));
}

module.exports = connectDB;