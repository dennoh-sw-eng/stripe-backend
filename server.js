//stripe-backend/server.js
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();

// CORS configuration - allow your app and localhost
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8081', // Expo dev server
    'https://stripe-backend-rvq9.onrender.com'
  ],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Shavahn Bible App - Stripe Backend API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Create payment intent endpoint
app.post('/create-payment-intent', async (req, res) => {
  try {
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

// Webhook endpoint for Stripe events (optional but recommended)
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
      // Here you could save to database, send email, etc.
      break;
    case 'payment_intent.payment_failed':
      console.log(`❌ Payment failed: ${event.data.object.id}`);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Shavahn Bible App - Stripe Backend`);
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}`);
  console.log(`💳 Stripe mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`);
});