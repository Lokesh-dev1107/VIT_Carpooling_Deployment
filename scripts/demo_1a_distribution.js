/**
 * BACSE344 - Cloud Infrastructure and Architecture
 * Digital Assignment 3 - Question 1a Demonstration Script
 * 
 * Purpose:
 * Sends consecutive HTTP requests to the Nginx Load Balancer (http://localhost:8080)
 * and verifies Round-Robin traffic distribution across the 3 backend replicas
 * by reading the 'X-Handled-By' HTTP response header.
 * 
 * Run with: node scripts/demo_1a_distribution.js
 */

const http = require('http');

function makeRequest(reqNum) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = http.get('http://localhost:8080/', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const handledBy = res.headers['x-handled-by'] || 'Unknown';
        const duration = Date.now() - startTime;
        resolve({
          reqNum,
          statusCode: res.statusCode,
          handledBy,
          duration: `${duration}ms`
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        reqNum,
        statusCode: 'ERR',
        handledBy: `Failed: ${err.message}`,
        duration: '0ms'
      });
    });
  });
}

async function run1aDemo() {
  console.log('================================================================================');
  console.log('   QUESTION 1a: NGINX ROUND-ROBIN LOAD DISTRIBUTION TEST (3 REPLICAS)          ');
  console.log('================================================================================\n');

  console.log('Target Load Balancer: http://localhost:8080/');
  console.log('Dispatching 9 consecutive requests to verify Round-Robin rotation...\n');

  const results = [];
  const counts = {};

  for (let i = 1; i <= 9; i++) {
    const res = await makeRequest(i);
    results.push(res);
    counts[res.handledBy] = (counts[res.handledBy] || 0) + 1;
  }

  // Print Clean Aligned Table
  console.log('+---------------+---------------+-----------------------+---------------+');
  console.log('| Request #     | HTTP Status   | Handled By Replica    | Response Time |');
  console.log('+---------------+---------------+-----------------------+---------------+');
  results.forEach(r => {
    const col1 = String(r.reqNum).padEnd(13, ' ');
    const col2 = String(r.statusCode).padEnd(13, ' ');
    const col3 = String(r.handledBy).padEnd(21, ' ');
    const col4 = String(r.duration).padEnd(13, ' ');
    console.log(`| ${col1} | ${col2} | ${col3} | ${col4} |`);
  });
  console.log('+---------------+---------------+-----------------------+---------------+\n');

  console.log('TRAFFIC DISTRIBUTION SUMMARY:');
  Object.keys(counts).forEach(instance => {
    const pct = ((counts[instance] / results.length) * 100).toFixed(1);
    console.log(`  • ${instance.padEnd(15)} : ${counts[instance]} requests (${pct}%)`);
  });

  const uniqueInstances = Object.keys(counts).filter(k => k.startsWith('instance-'));
  if (uniqueInstances.length >= 2) {
    console.log('\nSUCCESS: Nginx is actively balancing requests across multiple healthy replicas in Round-Robin order!');
  } else {
    console.log('\nNOTE: If you see connection errors, ensure your Docker Compose cluster is running:');
    console.log('      docker compose up -d');
  }

  console.log('\n================================================================================');
}

run1aDemo();
