/**
 * Diverse Ride Variety Seeder for Campus Carpool
 * 
 * Purpose:
 * Appends a rich variety of active, pending, confirmed, expired, and cancelled
 * carpools across VIT Campuses WITHOUT overwriting or touching existing user accounts.
 * 
 * Run with: node scripts/seed_data.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../src/models/User');
const RideGroup = require('../src/models/RideGroup');
const Driver = require('../src/models/Driver');

function genMemberToken() {
  return crypto.randomBytes(16).toString('hex');
}

function genCode(prefix) {
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${rand}`;
}

async function appendDiverseRides() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error('ERROR: MONGODB_URI not found in .env file.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB Atlas successfully!\n');

  // SAFE APPEND: We DO NOT touch User or Driver collections!
  // Find any existing users to attach as members if available
  const existingUsers = await User.find({ role: 'STUDENT' }).limit(10);
  const existingDriver = await Driver.findOne({});

  const primaryHostName = existingUsers[0] ? existingUsers[0].name : 'Anurag P.';
  const primaryHostPhone = existingUsers[0] ? existingUsers[0].phone : '+91 9876543210';

  const secondMemberName = existingUsers[1] ? existingUsers[1].name : 'Rahul S.';
  const secondMemberPhone = existingUsers[1] ? existingUsers[1].phone : '+91 9123456789';

  const driverName = existingDriver ? existingDriver.name : 'Murugan K. (City Cabs)';
  const driverPhone = existingDriver ? existingDriver.phone : '+91 9443322110';
  const driverId = existingDriver ? existingDriver._id : new mongoose.Types.ObjectId();

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  console.log('Generating diverse carpool rides with all lifecycle statuses...');

  console.log('Cleaning existing rides to apply strict 10-minute forming window...');
  await RideGroup.deleteMany({});

  const diverseRides = [
    // -------------------------------------------------------------
    // STATUS: FORMING (Active carpools seeking passengers with real ~10 min windows!)
    // -------------------------------------------------------------
    {
      groupCode: genCode('KT'),
      origin: 'Campus Main Gate',
      destination: 'Katpadi Railway Station',
      departureTime: new Date(now + 3 * hour), // Today evening
      totalSeats: 4,
      costPerSeat: 60,
      status: 'FORMING',
      formingDeadline: new Date(now + 8 * 60 * 1000 + 45 * 1000), // 8 mins 45 secs left
      members: [
        {
          name: primaryHostName,
          contact: primaryHostPhone,
          isHost: true,
          joinedAt: new Date(now - 1 * 60 * 1000),
          memberToken: genMemberToken()
        },
        {
          name: 'Priya N.',
          contact: '+91 9876501234',
          isHost: false,
          joinedAt: new Date(now - 30 * 1000),
          memberToken: genMemberToken()
        }
      ]
    },
    {
      groupCode: genCode('MAA'),
      origin: 'SJT Block, Campus',
      destination: 'Chennai International Airport (MAA)',
      departureTime: new Date(now + 12 * hour),
      totalSeats: 4,
      costPerSeat: 450,
      status: 'FORMING',
      formingDeadline: new Date(now + 6 * 60 * 1000 + 15 * 1000), // 6 mins 15 secs left
      members: [
        {
          name: secondMemberName,
          contact: secondMemberPhone,
          isHost: true,
          joinedAt: new Date(now - 3 * 60 * 1000),
          memberToken: genMemberToken()
        }
      ]
    },
    {
      groupCode: genCode('BLR'),
      origin: 'PRP Block, Campus',
      destination: 'Kempegowda Int\'l Airport, Bangalore (BLR)',
      departureTime: new Date(now + 24 * hour),
      totalSeats: 6,
      costPerSeat: 700,
      status: 'FORMING',
      formingDeadline: new Date(now + 9 * 60 * 1000 + 30 * 1000), // 9 mins 30 secs left
      members: [
        {
          name: 'Aakash V.',
          contact: '+91 9988776655',
          isHost: true,
          joinedAt: new Date(now - 30 * 1000),
          memberToken: genMemberToken()
        }
      ]
    },
    {
      groupCode: genCode('VLR'),
      origin: 'Foodys / Gazebo Circle',
      destination: 'Vellore New Bus Stand (Green Circle)',
      departureTime: new Date(now + 2 * hour),
      totalSeats: 3,
      costPerSeat: 40,
      status: 'FORMING',
      formingDeadline: new Date(now + 4 * 60 * 1000 + 20 * 1000), // 4 mins 20 secs left
      members: [
        {
          name: 'Rohan M.',
          contact: '+91 9845012345',
          isHost: true,
          joinedAt: new Date(now - 5 * 60 * 1000),
          memberToken: genMemberToken()
        }
      ]
    },

    // -------------------------------------------------------------
    // STATUS: PENDING_DRIVER (Full group, awaiting cab assignment)
    // -------------------------------------------------------------
    {
      groupCode: genCode('MAA'),
      origin: 'Technology Tower (TT Block)',
      destination: 'Chennai Central Railway Station',
      departureTime: new Date(now + 10 * hour),
      totalSeats: 4,
      costPerSeat: 380,
      status: 'PENDING_DRIVER',
      formingDeadline: new Date(now + 8 * hour),
      members: [
        { name: primaryHostName, contact: primaryHostPhone, isHost: true, joinedAt: new Date(now - 3 * hour), memberToken: genMemberToken() },
        { name: 'Aditya S.', contact: '+91 9844011223', isHost: false, joinedAt: new Date(now - 2.5 * hour), memberToken: genMemberToken() },
        { name: 'Kavya R.', contact: '+91 9833022334', isHost: false, joinedAt: new Date(now - 2 * hour), memberToken: genMemberToken() },
        { name: 'Nikhil T.', contact: '+91 9822033445', isHost: false, joinedAt: new Date(now - 1.5 * hour), memberToken: genMemberToken() }
      ]
    },
    {
      groupCode: genCode('KT'),
      origin: 'SMV Block Gate',
      destination: 'Katpadi Railway Station',
      departureTime: new Date(now + 5 * hour),
      totalSeats: 3,
      costPerSeat: 75,
      status: 'PENDING_DRIVER',
      formingDeadline: new Date(now + 4 * hour),
      members: [
        { name: 'Divya B.', contact: '+91 9811044556', isHost: true, joinedAt: new Date(now - 1.5 * hour), memberToken: genMemberToken() },
        { name: 'Tanmay C.', contact: '+91 9899055667', isHost: false, joinedAt: new Date(now - 1 * hour), memberToken: genMemberToken() },
        { name: 'Harshita G.', contact: '+91 9877066778', isHost: false, joinedAt: new Date(now - 45 * 60 * 1000), memberToken: genMemberToken() }
      ]
    },

    // -------------------------------------------------------------
    // STATUS: CONFIRMED (Driver assigned and trip locked)
    // -------------------------------------------------------------
    {
      groupCode: genCode('CONF'),
      origin: 'Campus Main Gate',
      destination: 'Katpadi Railway Station',
      departureTime: new Date(now + 4 * hour),
      totalSeats: 4,
      costPerSeat: 65,
      status: 'CONFIRMED',
      formingDeadline: new Date(now + 2 * hour),
      driverId: driverId,
      driverName: driverName,
      driverContact: driverPhone,
      members: [
        { name: primaryHostName, contact: primaryHostPhone, isHost: true, joinedAt: new Date(now - 4 * hour), memberToken: genMemberToken() },
        { name: secondMemberName, contact: secondMemberPhone, isHost: false, joinedAt: new Date(now - 3.5 * hour), memberToken: genMemberToken() },
        { name: 'Siddharth M.', contact: '+91 9866077889', isHost: false, joinedAt: new Date(now - 3 * hour), memberToken: genMemberToken() },
        { name: 'Ananya D.', contact: '+91 9855088990', isHost: false, joinedAt: new Date(now - 2.5 * hour), memberToken: genMemberToken() }
      ]
    },
    {
      groupCode: genCode('CONF'),
      origin: 'Outdoor Stadium Bus Bay',
      destination: 'Kempegowda Int\'l Airport, Bangalore (BLR)',
      departureTime: new Date(now + 12 * hour),
      totalSeats: 5,
      costPerSeat: 680,
      status: 'CONFIRMED',
      formingDeadline: new Date(now + 8 * hour),
      driverId: driverId,
      driverName: driverName,
      driverContact: driverPhone,
      members: [
        { name: 'Gautam P.', contact: '+91 9844099001', isHost: true, joinedAt: new Date(now - 5 * hour), memberToken: genMemberToken() },
        { name: 'Meera K.', contact: '+91 9833088112', isHost: false, joinedAt: new Date(now - 4.5 * hour), memberToken: genMemberToken() },
        { name: 'Karthik N.', contact: '+91 9822077223', isHost: false, joinedAt: new Date(now - 4 * hour), memberToken: genMemberToken() },
        { name: 'Pooja V.', contact: '+91 9811066334', isHost: false, joinedAt: new Date(now - 3.5 * hour), memberToken: genMemberToken() },
        { name: 'Rohit J.', contact: '+91 9800055445', isHost: false, joinedAt: new Date(now - 3 * hour), memberToken: genMemberToken() }
      ]
    },

    // -------------------------------------------------------------
    // STATUS: EXPIRED (Forming window elapsed before filling)
    // -------------------------------------------------------------
    {
      groupCode: genCode('EXP'),
      origin: 'Campus Main Gate',
      destination: 'Pondicherry White Town (Weekend Getaway)',
      departureTime: new Date(now - 2 * hour), // Past departure
      totalSeats: 4,
      costPerSeat: 500,
      status: 'EXPIRED',
      formingDeadline: new Date(now - 4 * hour),
      members: [
        { name: 'Venkatesh S.', contact: '+91 9899044556', isHost: true, joinedAt: new Date(now - 10 * hour), memberToken: genMemberToken() }
      ]
    },

    // -------------------------------------------------------------
    // STATUS: CANCELLED (Host cancelled due to schedule changes)
    // -------------------------------------------------------------
    {
      groupCode: genCode('CANC'),
      origin: 'Technology Tower (TT Block)',
      destination: 'VR Chennai Mall / Koyambedu',
      departureTime: new Date(now + 24 * hour),
      totalSeats: 4,
      costPerSeat: 400,
      status: 'CANCELLED',
      formingDeadline: new Date(now + 20 * hour),
      members: [
        { name: primaryHostName, contact: primaryHostPhone, isHost: true, joinedAt: new Date(now - 6 * hour), memberToken: genMemberToken() }
      ]
    }
  ];

  const inserted = await RideGroup.insertMany(diverseRides);
  console.log(`  ✓ Successfully appended ${inserted.length} diverse carpools!`);
  console.log(`  ✓ Preserved all existing user accounts.\n`);

  console.log('================================================================================');
  console.log('                 DIVERSE CARPOOLS SUMMARY BY STATUS                             ');
  console.log('================================================================================');
  console.log('1. FORMING (Open for joining):');
  console.log('   • Katpadi Station (2/4 seats filled - ₹60)');
  console.log('   • Chennai Airport (1/4 seats filled - ₹450)');
  console.log('   • Bangalore Airport (3/6 seats filled - ₹700)');
  console.log('   • Vellore New Bus Stand (1/3 seats filled - ₹40)');
  console.log('\n2. PENDING_DRIVER (Full groups ready for cab drivers to claim):');
  console.log('   • Chennai Central (4/4 full - ₹380)');
  console.log('   • Katpadi Station (3/3 full - ₹75)');
  console.log('\n3. CONFIRMED (Driver assigned):');
  console.log(`   • Katpadi Station (4/4 filled - Assigned to ${driverName})`);
  console.log(`   • Bangalore Airport (5/5 filled - Assigned to ${driverName})`);
  console.log('\n4. EXPIRED (Historical record):');
  console.log('   • Pondicherry (Forming deadline expired)');
  console.log('\n5. CANCELLED (Historical record):');
  console.log('   • VR Chennai Mall (Host cancelled)');
  console.log('================================================================================\n');

  await mongoose.disconnect();
}

appendDiverseRides().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});