// backend/test-server.js - Simple test script for your backend
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://stripe-backend-rvq9.onrender.com'
  : 'http://localhost:3000';

async function testBackend() {
  console.log('🧪 Testing Shavahn Bible App Backend');
  console.log(`📍 Testing URL: ${BACKEND_URL}`);
  console.log('=' .repeat(50));

  // Test 1: Health Check
  try {
    console.log('\n1️⃣ Testing health check endpoint...');
    const response = await fetch(`${BACKEND_URL}/`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health check passed');
      console.log(`   Status: ${data.status}`);
      console.log(`   Message: ${data.message}`);
    } else {
      console.log('❌ Health check failed');
      console.log(`   Status: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ Health check failed with error:', error.message);
  }

  // Test 2: Payment Intent Creation
  try {
    console.log('\n2️⃣ Testing payment intent creation...');
    const response = await fetch(`${BACKEND_URL}/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 1000, // $10.00
        currency: 'usd',
        metadata: {
          test: true,
          source: 'backend-test'
        }
      }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Payment intent creation passed');
      console.log(`   Client Secret: ${data.clientSecret ? 'Generated ✓' : 'Missing ❌'}`);
      console.log(`   Payment Intent ID: ${data.paymentIntentId ? 'Generated ✓' : 'Missing ❌'}`);
    } else {
      console.log('❌ Payment intent creation failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error}`);
    }
  } catch (error) {
    console.log('❌ Payment intent creation failed with error:', error.message);
  }

  // Test 3: Invalid Amount Validation
  try {
    console.log('\n3️⃣ Testing amount validation...');
    const response = await fetch(`${BACKEND_URL}/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 10, // Less than minimum (50 cents)
        currency: 'usd'
      }),
    });

    const data = await response.json();
    
    if (response.status === 400) {
      console.log('✅ Amount validation passed');
      console.log(`   Error message: ${data.error}`);
    } else {
      console.log('❌ Amount validation failed - should reject small amounts');
    }
  } catch (error) {
    console.log('❌ Amount validation test failed with error:', error.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('🏁 Backend testing completed!');
  console.log('\nIf all tests passed ✅, your backend is ready!');
  console.log('If any tests failed ❌, check your .env file and Stripe keys.');
}

// Run the tests
testBackend();

module.exports = { testBackend };