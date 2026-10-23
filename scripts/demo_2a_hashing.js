/**
 * BACSE344 - Cloud Infrastructure and Architecture
 * Digital Assignment 3 - Question 2a Demonstration Script
 * 
 * Purpose:
 * Demonstrates the transition from insecure Plaintext Passwords ("Before")
 * to Salted Cryptographic Hashing using bcrypt with 10 salt rounds ("After").
 * 
 * Run with: node scripts/demo_2a_hashing.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function run2aDemo() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('Error: MONGODB_URI not found in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB Atlas!\n');

  const db = mongoose.connection.db;

  // 1. INSECURE "BEFORE" DEMONSTRATION
  const insecureUser = {
    name: 'Rahul Sharma (Student)',
    phone: '+91 9876543210',
    role: 'STUDENT',
    password_PLAINTEXT_INSECURE: 'CampusRider@2026', // Stored in plain text!
    storageMethod: 'Plaintext (Vulnerable to credential harvesting)',
    createdAt: new Date()
  };

  const beforeCol = db.collection('demo_2a_before_plaintext');
  await beforeCol.deleteMany({}); // reset demo collection
  const beforeResult = await beforeCol.insertOne(insecureUser);

  // 2. SECURE "AFTER" DEMONSTRATION (Salted Hash with bcrypt)
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  const passwordHash = await bcrypt.hash('CampusRider@2026', salt);

  const secureUser = {
    name: 'Rahul Sharma (Student)',
    phone: '+91 9876543210',
    role: 'STUDENT',
    passwordHash: passwordHash, // Stored as salted bcrypt hash ($2a$10$...)
    saltRounds: saltRounds,
    storageMethod: 'Bcrypt Salted Hash (OWASP & DPDP Compliant)',
    createdAt: new Date()
  };

  const afterCol = db.collection('demo_2a_after_salted_hash');
  await afterCol.deleteMany({}); // reset demo collection
  const afterResult = await afterCol.insertOne(secureUser);

  console.log('================================================================================');
  console.log('       QUESTION 2a: SENSITIVE DATA & PASSWORD HASHING DEMONSTRATION             ');
  console.log('================================================================================\n');

  console.log('--- [BEFORE] INSECURE RECORD (Stored in demo_2a_before_plaintext) ---');
  console.log(JSON.stringify({
    _id: beforeResult.insertedId,
    name: insecureUser.name,
    phone: insecureUser.phone,
    role: insecureUser.role,
    password: insecureUser.password_PLAINTEXT_INSECURE,
    vulnerability: 'CRITICAL: Anyone with read access to DB sees raw password!'
  }, null, 2));

  console.log('\n--- [AFTER] SECURE RECORD (Stored in demo_2a_after_salted_hash) ---');
  console.log(JSON.stringify({
    _id: afterResult.insertedId,
    name: secureUser.name,
    phone: secureUser.phone,
    role: secureUser.role,
    passwordHash: secureUser.passwordHash,
    security: 'SECURE: One-way hash with random cryptographic salt ($2a$10$...)'
  }, null, 2));

  console.log('\n================================================================================');
  console.log('SUCCESS: Both collections updated in MongoDB Atlas!');
  console.log('You can now open MongoDB Atlas or Compass to take your assignment screenshot,');
  console.log('or capture the terminal output above.');
  console.log('================================================================================\n');

  await mongoose.disconnect();
}

run2aDemo().catch(err => {
  console.error('Demo failed:', err);
  process.exit(1);
});
