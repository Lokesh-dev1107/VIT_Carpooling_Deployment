/**
 * BACSE344 - Cloud Infrastructure and Architecture
 * Digital Assignment 3 - Question 2d Demonstration Script
 * 
 * Purpose:
 * Demonstrates Threat Agent Modeling and Regulatory Compliance (India DPDP Act 2023 & GDPR)
 * for the Campus Carpool platform.
 * 
 * Run with: node scripts/demo_2d_compliance.js
 */

function run2dDemo() {
  console.log('================================================================================');
  console.log('    QUESTION 2d: THREAT AGENT MODELING & REGULATORY COMPLIANCE AUDIT           ');
  console.log('================================================================================\n');

  console.log('1. THREAT AGENT 1: FAKE DRIVER / PHONE NUMBER HARVESTER (PRIVACY THREAT)');
  console.log('--------------------------------------------------------------------------------');
  console.log('   • Threat Profile: Malicious unauthorized actor or unverified commercial driver.');
  console.log('   • Attack Vector : Browsing carpools to harvest student phone numbers or posing');
  console.log('                     as an official VIT cab operator.');
  console.log('   • Impact        : Student stalking, spam, harassment, and unvetted vehicle safety.');
  console.log('   • Implemented Technical Controls:');
  console.log('     1. Driver Verification Gate: Drivers must be verified by Transport Admin');
  console.log('        before they can accept or coordinate rides (role="DRIVER", isVerified=true).');
  console.log('     2. Dynamic PII Masking: Passenger phone numbers remain "Hidden until accepted"');
  console.log('        on both API and UI layers.');
  console.log('     3. TOTP MFA on Driver/Admin: Mandatory Google Authenticator 2FA.');
  console.log('   • Regulatory Mapping:');
  console.log('     -> India DPDP Act 2023, Section 6 (Notice and Consent for Personal Data)');
  console.log('     -> GDPR Article 5(1)(c) (Data Minimization: only necessary data exposed)\n');

  console.log('2. THREAT AGENT 2: MALICIOUS SEAT SCALPER / BOTNET (AVAILABILITY THREAT)');
  console.log('--------------------------------------------------------------------------------');
  console.log('   • Threat Profile: Competitor or disgruntled student running automated bot scripts.');
  console.log('   • Attack Vector : Race conditions & rapid concurrent POST requests during peak');
  console.log('                     exam exodus (Katpadi Station / Chennai Airport rush).');
  console.log('   • Impact        : Legitimate students locked out of shared cabs, driver cancellations.');
  console.log('   • Implemented Technical Controls:');
  console.log('     1. Atomic Concurrency Lock: MongoDB findOneAndUpdate with $expr array size check');
  console.log('        guarantees zero over-booking even under 100 simultaneous requests.');
  console.log('     2. Private 6-Character Group Codes: Prevents scrapers from discovering private trips.');
  console.log('     3. Strict Cutoffs: 2-hour departure cutoff and 10-minute host lock.');
  console.log('   • Regulatory Mapping:');
  console.log('     -> GDPR Article 32 (Security of Processing - System Availability & Resilience)');
  console.log('     -> ISO/IEC 27001 Control A.12.1.3 (Capacity Management)\n');

  console.log('3. SENSITIVE DATA CLASSIFICATION MATRIX');
  console.log('--------------------------------------------------------------------------------');
  const dataMatrix = [
    { tier: 'Tier 1 (Confidential)', fields: 'Passwords, TOTP Secrets, JWT Secret', protection: 'Bcrypt salt(10), Base32, HMAC-SHA256' },
    { tier: 'Tier 2 (Protected PII)', fields: 'Student Name, Phone Number, Travel Time', protection: 'Masked until accepted, RBAC restricted' },
    { tier: 'Tier 3 (Operational)', fields: 'Pickup, Destination, Seat Count, Fare', protection: 'Public read-only for carpool discovery' }
  ];

  const headers = {
    tier: 'Classification Tier',
    fields: 'Application Data Fields',
    protection: 'Applied Protection Mechanism'
  };

  const w1 = Math.max(headers.tier.length, ...dataMatrix.map(d => d.tier.length)) + 2;
  const w2 = Math.max(headers.fields.length, ...dataMatrix.map(d => d.fields.length)) + 2;
  const w3 = Math.max(headers.protection.length, ...dataMatrix.map(d => d.protection.length)) + 2;

  const border = `+${'-'.repeat(w1 + 2)}+${'-'.repeat(w2 + 2)}+${'-'.repeat(w3 + 2)}+`;

  console.log(border);
  console.log(`| ${headers.tier.padEnd(w1)} | ${headers.fields.padEnd(w2)} | ${headers.protection.padEnd(w3)} |`);
  console.log(border);
  dataMatrix.forEach(row => {
    console.log(`| ${row.tier.padEnd(w1)} | ${row.fields.padEnd(w2)} | ${row.protection.padEnd(w3)} |`);
  });
  console.log(border + '\n');

  console.log('4. LIVE UI REFERENCES FOR THE EVALUATOR:');
  console.log('   • Safety & Privacy Policy Page: http://localhost:5001/privacy.html');
  console.log('   • Admin Driver Verification   : http://localhost:5001/admin.html');
  console.log('   • MFA Authenticator Setup     : http://localhost:5001/profile.html\n');

  console.log('================================================================================');
  console.log('Question 2d demonstration complete. Data and threat models ready for report.');
  console.log('================================================================================\n');
}

run2dDemo();
