/**
 * Database Reset Script for Campus Carpool
 * 
 * Purpose:
 * Clears all test data (Ride Groups, Users, Drivers) from MongoDB Atlas
 * so you can test fresh from a clean state.
 * 
 * Run with: node scripts/reset_db.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const RideGroup = require('../src/models/RideGroup');
const Driver = require('../src/models/Driver');

async function resetDatabase() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error('ERROR: MONGODB_URI not found in .env file.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully.\n');

    console.log('Clearing database collections:');
    const ridesDeleted = await RideGroup.deleteMany({});
    console.log(`  • Deleted ${ridesDeleted.deletedCount} ride groups.`);

    const usersDeleted = await User.deleteMany({});
    console.log(`  • Deleted ${usersDeleted.deletedCount} user accounts.`);

    const driversDeleted = await Driver.deleteMany({});
    console.log(`  • Deleted ${driversDeleted.deletedCount} driver profiles.`);

    console.log('\n================================================================================');
    console.log('DATABASE RESET COMPLETE — CLEAN SLATE READY!');
    console.log('================================================================================');
    console.log('NEXT STEPS FOR TESTING:');
    console.log('1. In your browser, open Developer Tools (F12) -> Application -> Local Storage.');
    console.log('   Clear all keys (or click Logout) so old session tokens are wiped.');
    console.log('2. Register User A (Student 1, e.g. Phone 9876543210) -> Create a Ride.');
    console.log('3. Register User B (Student 2, e.g. Phone 9123456789) -> Join with Code.');
    console.log('   -> User A will see "Cancel ride (Host)".');
    console.log('   -> User B will ONLY see "Leave ride" (Cancel button is completely hidden!).');
    console.log('================================================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Database reset failed:', err.message);
    process.exit(1);
  }
}

resetDatabase();
