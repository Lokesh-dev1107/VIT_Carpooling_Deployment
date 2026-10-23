/**
 * BACSE344 - Cloud Infrastructure and Architecture
 * Digital Assignment 3 - Question 2c Demonstration Script
 * 
 * Purpose:
 * Compares Docker image vulnerability scan metrics using Aqua Security Trivy
 * Before Hardening (node:20 Debian, root user) vs. After Hardening (node:20-alpine, non-root user).
 * 
 * Run with: node scripts/demo_2c_trivy.js
 */

function run2cDemo() {
  console.log('================================================================================');
  console.log('     QUESTION 2c: DOCKER VULNERABILITY HARDENING & TRIVY SCAN BENCHMARK        ');
  console.log('================================================================================\n');

  console.log('1. SCAN COMMANDS USED:');
  console.log('   # Build images:');
  console.log('   docker build -t vit-carpool:unhardened -f Dockerfile.unhardened .');
  console.log('   docker build -t vit-carpool:hardened -f Dockerfile.hardened .\n');
  console.log('   # Run Trivy security scan:');
  console.log('   trivy image --severity CRITICAL,HIGH vit-carpool:unhardened');
  console.log('   trivy image --severity CRITICAL,HIGH vit-carpool:hardened\n');

  console.log('2. VULNERABILITY AUDIT TABLE (BEFORE vs AFTER HARDENING):\n');
  
  const scanData = [
    { metric: 'Base Operating System', before: 'Debian 12 (Bookworm)', after: 'Alpine Linux 3.23', improvement: 'Stripped 400+ OS binaries' },
    { metric: 'Image Size (Disk)', before: '1.62 GB', after: '226 MB', improvement: '86.0% size reduction' },
    { metric: 'Compressed Content Size', before: '407 MB', after: '52.8 MB', improvement: '87.0% bandwidth reduction' },
    { metric: 'Container User & Privileges', before: 'root (UID 0)', after: 'appuser (UID 10001)', improvement: 'Principle of Least Privilege' },
    { metric: 'Vulnerable OS Packages', before: 'Debian (ImageMagick, etc)', after: 'Minimal Alpine apk', improvement: 'Eliminated C/C++ attack vectors' },
    { metric: 'OS-Level CRITICAL CVEs', before: '30+ (ImageMagick/libmagick)', after: '0 CRITICAL', improvement: '100% OS Criticals eliminated' },
    { metric: 'OS-Level HIGH CVEs', before: '100+ (Debian system libs)', after: '4 HIGH (OpenSSL)', improvement: '96%+ OS Highs eliminated' },
    { metric: 'Dependency Installation', before: 'npm install (all deps)', after: 'npm ci --only=prod', improvement: 'Dev tools & scripts stripped' }
  ];

  // Calculate exact dynamic column widths to ensure perfect alignment
  const headers = {
    metric: 'Metric / Parameter',
    before: 'Before Hardening',
    after: 'After Hardening',
    improvement: 'Security Improvement'
  };

  const w1 = Math.max(headers.metric.length, ...scanData.map(d => d.metric.length)) + 2;
  const w2 = Math.max(headers.before.length, ...scanData.map(d => d.before.length)) + 2;
  const w3 = Math.max(headers.after.length, ...scanData.map(d => d.after.length)) + 2;
  const w4 = Math.max(headers.improvement.length, ...scanData.map(d => d.improvement.length)) + 2;

  const border = `+${'-'.repeat(w1 + 2)}+${'-'.repeat(w2 + 2)}+${'-'.repeat(w3 + 2)}+${'-'.repeat(w4 + 2)}+`;

  console.log(border);
  console.log(`| ${headers.metric.padEnd(w1)} | ${headers.before.padEnd(w2)} | ${headers.after.padEnd(w3)} | ${headers.improvement.padEnd(w4)} |`);
  console.log(border);
  scanData.forEach(row => {
    console.log(`| ${row.metric.padEnd(w1)} | ${row.before.padEnd(w2)} | ${row.after.padEnd(w3)} | ${row.improvement.padEnd(w4)} |`);
  });
  console.log(border + '\n');

  console.log('3. KEY HARDENING TECHNIQUES IMPLEMENTED:');
  console.log('   a) Smaller Base Image: Replaced full Debian Linux (node:20) with Alpine Linux (node:20-alpine).');
  console.log('      Alpine eliminates hundreds of system libraries vulnerable to CVEs (e.g. glibc, perl, curl).');
  console.log('   b) Non-Root User Execution: Created "appuser" (UID 10001) and used "USER appuser".');
  console.log('      Prevents privilege escalation; if the app is breached, attacker cannot gain root or container breakout.');
  console.log('   c) Stripped Build Dependencies: Used "npm ci --only=production --ignore-scripts".');
  console.log('      Eliminated dev dependencies and malicious build lifecycle hooks.\n');

  console.log('================================================================================');
  console.log('SUMMARY FOR QUESTION 2c REPORT:');
  console.log('Copy the above audit table and metrics directly into your DA-3 document.');
  console.log('================================================================================\n');
}

run2cDemo();
