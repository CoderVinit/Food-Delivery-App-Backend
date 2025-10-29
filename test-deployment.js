// Simple test script to verify deployment configuration
const fetch = require('node-fetch'); // You might need to install: npm install node-fetch

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function testDeployment() {
    console.log('Testing deployment configuration...\n');
    console.log(`Backend URL: ${BACKEND_URL}`);
    console.log(`Frontend URL: ${FRONTEND_URL}\n`);

    try {
        // Test 1: Health check
        console.log('1. Testing health check...');
        const healthResponse = await fetch(`${BACKEND_URL}/health`);
        console.log(`   Status: ${healthResponse.status}`);
        const healthData = await healthResponse.text();
        console.log(`   Response: ${healthData}\n`);

        // Test 2: CORS test
        console.log('2. Testing CORS configuration...');
        const corsResponse = await fetch(`${BACKEND_URL}/test-cors`, {
            headers: {
                'Origin': FRONTEND_URL
            }
        });
        console.log(`   Status: ${corsResponse.status}`);
        const corsData = await corsResponse.json();
        console.log(`   Response:`, corsData);
        console.log(`   CORS Headers:`, corsResponse.headers.get('access-control-allow-origin'));

    } catch (error) {
        console.error('Error testing deployment:', error.message);
    }
}

testDeployment();