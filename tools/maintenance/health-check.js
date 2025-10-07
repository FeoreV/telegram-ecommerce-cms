#!/usr/bin/env node

const http = require('http');

async function checkEndpoint(url, name) {
  return new Promise((resolve) => {
    const request = http.get(url, (res) => {
      const statusCode = res.statusCode;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (statusCode === 200 && json.status === 'OK') {
            console.log(`✅ ${name}: OK`);
            resolve(true);
          } else {
            console.log(`❌ ${name}: Failed (${statusCode})`);
            resolve(false);
          }
        } catch (e) {
          console.log(`❌ ${name}: Invalid JSON response`);
          resolve(false);
        }
      });
    });
    
    request.on('error', (err) => {
      console.log(`❌ ${name}: Connection failed (${err.message})`);
      resolve(false);
    });
    
    request.setTimeout(5000, () => {
      console.log(`❌ ${name}: Timeout`);
      request.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log('🔍 Checking system health...\n');
  
  const checks = [
    { url: 'http://82.147.84.78:3001/health', name: 'Backend API' },
    { url: 'http://82.147.84.78:3001/api', name: 'Backend API Info' },
  ];
  
  const results = await Promise.all(
    checks.map(check => checkEndpoint(check.url, check.name))
  );
  
  const allHealthy = results.every(result => result);
  
  console.log('\n' + '='.repeat(40));
  if (allHealthy) {
    console.log('🎉 All systems healthy!');
    process.exit(0);
  } else {
    console.log('⚠️  Some systems are down!');
    process.exit(1);
  }
}

main().catch(console.error);
