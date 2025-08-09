// stripe-backend/server.js - Fixed CORS and API endpoints
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:8081',
    'http://localhost:19006',
    'http://192.168.1.100:8081', // Add your local IP
    'exp://192.168.1.100:8081',  // Expo development
    'https://stripe-backend-rvq9.onrender.com',
    /^https:\/\/.*\.exp\.direct$/,  // Expo tunnel URLs
    /^https:\/\/.*\.ngrok\.io$/,    // ngrok URLs
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Add preflight OPTIONS handler for all routes
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.headers.origin || 'unknown'}`);
  next();
});

// Enhanced health check endpoint
app.get('/', (req, res) => {
  const headers = req.headers;
  console.log(`Health check from: ${headers.origin || 'unknown'}`);
  
  res.json({ 
    message: 'Shavahn Bible App - Payment Backend API',
    status: 'running',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    stripe_mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST',
    endpoints: [
      'POST /api/stripe/payment-intent',
      'POST /api/paypal/create-order',
      'POST /api/paypal/execute-payment'
    ]
  });
});

// STRIPE ENDPOINTS
app.post('/api/stripe/payment-intent', async (req, res) => {
  try {
    console.log(`Stripe payment intent request from: ${req.headers.origin || 'unknown'}`);
    console.log('Request body:', req.body);
    
    const { amount, currency = 'usd', metadata } = req.body;

    // Validate amount
    if (!amount || amount < 50) { // Minimum $0.50
      return res.status(400).json({ 
        error: 'Amount must be at least $0.50 (50 cents)' 
      });
    }

    if (amount > 999999) { // Maximum $9,999.99
      return res.status(400).json({ 
        error: 'Amount cannot exceed $9,999.99' 
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Ensure it's an integer
      currency: currency.toLowerCase(),
      metadata: {
        app: 'shavahn-bible',
        type: 'donation',
        origin: req.headers.origin || 'unknown',
        ...metadata
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log(`✅ Payment intent created: ${paymentIntent.id} for $${amount/100}`);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('❌ Payment intent creation failed:', error.message);
    res.status(500).json({ 
      error: error.message,
      type: 'stripe_error'
    });
  }
});

// PAYPAL ENDPOINTS
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    console.log(`PayPal order creation request from: ${req.headers.origin || 'unknown'}`);
    console.log('Request body:', req.body);
    
    const { amount, currency = 'USD' } = req.body;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({ 
        error: 'Amount must be at least $1.00' 
      });
    }

    // For now, return a mock response until PayPal SDK is properly integrated
    const orderId = `PAYPAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`✅ PayPal order created: ${orderId} for $${amount}`);

    res.json({
      orderID: orderId,
      amount: amount,
      currency: currency
    });

  } catch (error) {
    console.error('❌ PayPal order creation failed:', error.message);
    res.status(500).json({ 
      error: error.message,
      type: 'paypal_error'
    });
  }
});

app.post('/api/paypal/execute-payment', async (req, res) => {
  try {
    console.log(`PayPal payment execution request from: ${req.headers.origin || 'unknown'}`);
    console.log('Request body:', req.body);
    
    const { paymentId, payerId } = req.body;

    if (!paymentId || !payerId) {
      return res.status(400).json({ 
        error: 'Missing paymentId or payerId' 
      });
    }

    // Mock successful execution for now
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`✅ PayPal payment executed: ${paymentId}`);

    res.json({
      success: true,
      paymentId: paymentId,
      transactionId: transactionId,
      status: 'completed'
    });

  } catch (error) {
    console.error('❌ PayPal payment execution failed:', error.message);
    res.status(500).json({ 
      error: error.message,
      type: 'paypal_error'
    });
  }
});

// Add a test endpoint for network debugging
app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    timestamp: new Date().toISOString(),
    headers: req.headers,
    ip: req.ip || req.connection.remoteAddress,
    cors: 'working'
  });
});

// Webhook endpoint for Stripe events
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`❌ Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
      break;
    case 'payment_intent.payment_failed':
      console.log(`❌ Payment failed: ${event.data.object.id}`);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Endpoint not found',
    method: req.method,
    url: req.originalUrl,
    available_endpoints: [
      'GET /',
      'GET /test',
      'POST /api/stripe/payment-intent',
      'POST /api/paypal/create-order',
      'POST /api/paypal/execute-payment'
    ],
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Shavahn Bible App - Payment Backend`);
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}`);
  console.log(`🌐 Production: https://stripe-backend-rvq9.onrender.com`);
  console.log(`💳 Stripe mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 CORS enabled for multiple origins`);
});