/**
 * BACSE344 - Cloud Infrastructure and Architecture
 * Digital Assignment 3 - Question 2b Demonstration Script
 * 
 * Purpose:
 * Demonstrates:
 * 1. TOTP Multi-Factor Authentication token generation and verification using otplib.
 * 2. LIVE HTTP call with NO token -> 401 Unauthorized.
 * 3. LIVE HTTP call with STUDENT role token -> 403 Forbidden.
 * 4. LIVE HTTP call with ADMIN role token -> 200 OK.
 * 
 * Run with: node scripts/demo_2b_rbac.js
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const { generateSecret, generateSync, verifySync, generateURI } = require('otplib');

async function run2bDemo() {
  const JWT_SECRET = process.env.JWT_SECRET || 'f450cc0d236afec404dc73e1a1d6a3c2349b9013063ea36767e389b2b9c6175b';
  
  // Prefer load balancer port 8088, fallback to 5001
  let baseUrl = 'http://localhost:8088';
  try {
    const res = await fetch(`${baseUrl}/api/groups`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok && res.status >= 500) baseUrl = 'http://localhost:5001';
  } catch (e) {
    baseUrl = 'http://localhost:5001';
  }

  console.log('================================================================================');
  console.log('     QUESTION 2b: MULTI-FACTOR AUTHENTICATION & LIVE RBAC ENFORCEMENT           ');
  console.log('================================================================================\n');

  // PART 1: TOTP MFA GENERATION & VERIFICATION
  console.log('--- PART 1: TOTP MULTI-FACTOR AUTHENTICATION (RFC 6238 Standard) ---');
  const driverSecret = generateSecret();
  const otpauthUrl = generateURI({ issuer: 'Campus Carpool', label: '+91 9876543210', secret: driverSecret });
  const currentToken = generateSync({ secret: driverSecret });
  const verification = verifySync({ token: currentToken, secret: driverSecret });

  console.log(`Driver TOTP Secret Key : ${driverSecret}`);
  console.log(`Authenticator URI      : ${otpauthUrl}`);
  console.log(`Generated 6-Digit Code : [ ${currentToken} ] (Valid for 30s window)`);
  console.log(`Server Verification    : ${verification && verification.valid ? '✓ SUCCESS (Code matches Secret & Server Timestamp)' : '✗ FAILED'}\n`);

  // PART 2: LIVE RBAC REJECTION & AUTHORIZATION TESTS
  console.log('--- PART 2: LIVE HTTP CALLS TO PROTECTED ADMIN ENDPOINT ---');
  console.log(`Target Host: ${baseUrl}/api/admin/system-check\n`);

  // Sign real signed JWT tokens
  const studentToken = jwt.sign(
    { id: 'usr_student_01', name: 'Rahul (Student)', phone: '+91 9123456780', role: 'STUDENT' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { id: 'usr_admin_01', name: 'Transport Supervisor', phone: '+91 9999900000', role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Helper to execute real HTTP request
  async function testEndpoint(testName, tokenHeader) {
    const headers = { 'Content-Type': 'application/json' };
    if (tokenHeader) headers['Authorization'] = `Bearer ${tokenHeader}`;

    try {
      const response = await fetch(`${baseUrl}/api/admin/system-check`, {
        method: 'PATCH',
        headers
      });

      const body = await response.json();
      console.log(`[${testName}]`);
      console.log(`  > PATCH ${baseUrl}/api/admin/system-check`);
      if (tokenHeader) {
        const decoded = jwt.decode(tokenHeader);
        console.log(`  > Header: Authorization: Bearer eyJ... (Role: ${decoded.role})`);
      } else {
        console.log(`  > Header: Authorization: NONE`);
      }
      console.log(`  < HTTP/1.1 ${response.status} ${response.statusText}`);
      console.log(`  < Response Body: ${JSON.stringify(body, null, 2).replace(/\n/g, '\n    ')}\n`);
    } catch (err) {
      console.log(`  [Connection Note: Run docker compose or server locally to see live responses (${err.message})]\n`);
    }
  }

  await testEndpoint('TEST 1: Request with NO Token (Expect 401 Unauthorized)', null);
  await testEndpoint('TEST 2: Request with STUDENT Token (Expect 403 Forbidden)', studentToken);
  await testEndpoint('TEST 3: Request with ADMIN Token (Expect 200 OK)', adminToken);


  console.log('# 1. Test 401 Unauthorized (No Token):');
  console.log(`curl.exe -i -X PATCH ${baseUrl}/api/admin/system-check\n`);
  console.log('# 2. Test 403 Forbidden (Student Token):');
  console.log(`curl.exe -i -X PATCH ${baseUrl}/api/admin/system-check -H "Authorization: Bearer ${studentToken}"\n`);
  console.log('# 3. Test 200 OK (Admin Token):');
  console.log(`curl.exe -i -X PATCH ${baseUrl}/api/admin/system-check -H "Authorization: Bearer ${adminToken}"\n`);

}

run2bDemo();
