// stripe-backend/routes/paypal.js
const express = require('express');
const paypal = require('@paypal/checkout-server-sdk');
const router = express.Router();

// PayPal environment setup
function getPayPalEnvironment() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not found in environment variables');
  }

  // Use sandbox for development, live for production
  const environment = process.env.NODE_ENV === 'production' 
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);
    
  return environment;
}

function getPayPalClient() {
  return new paypal.core.PayPalHttpClient(getPayPalEnvironment());
}

// Create PayPal order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'USD' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: 'CAPTURE',
      application_context: {
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/paypal/success`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/paypal/cancel`,
        brand_name: 'Shavahn Bible App',
        user_action: 'PAY_NOW',
      },
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toString(),
        },
        description: 'Donation to Shavahn Bible App Ministry',
      }],
    });

    const client = getPayPalClient();
    const response = await client.execute(request);

    res.json({
      id: response.result.id,
      status: response.result.status,
      links: response.result.links,
    });
  } catch (error) {
    console.error('PayPal create order error:', error);
    res.status(500).json({ 
      error: 'Failed to create PayPal order',
      details: error.message 
    });
  }
});

// Execute/Capture PayPal payment
router.post('/execute-payment', async (req, res) => {
  try {
    const { paymentId, payerId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }

    const request = new paypal.orders.OrdersCaptureRequest(paymentId);
    request.requestBody({});

    const client = getPayPalClient();
    const response = await client.execute(request);

    // Log successful donation (you can save to database here)
    console.log('PayPal donation completed:', {
      orderId: response.result.id,
      status: response.result.status,
      amount: response.result.purchase_units[0].payments.captures[0].amount.value,
      currency: response.result.purchase_units[0].payments.captures[0].amount.currency_code,
      timestamp: new Date().toISOString(),
    });

    res.json({
      id: response.result.id,
      status: response.result.status,
      payer: response.result.payer,
      purchase_units: response.result.purchase_units,
    });
  } catch (error) {
    console.error('PayPal execute payment error:', error);
    res.status(500).json({ 
      error: 'Failed to execute PayPal payment',
      details: error.message 
    });
  }
});

// Get PayPal order details
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const request = new paypal.orders.OrdersGetRequest(orderId);
    const client = getPayPalClient();
    const response = await client.execute(request);

    res.json(response.result);
  } catch (error) {
    console.error('PayPal get order error:', error);
    res.status(500).json({ 
      error: 'Failed to get PayPal order details',
      details: error.message 
    });
  }
});

// Webhook handler for PayPal events
router.post('/webhook', async (req, res) => {
  try {
    // In production, you should verify the webhook signature
    const event = req.body;
    
    console.log('PayPal webhook received:', event.event_type);
    
    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        console.log('Order approved:', event.resource.id);
        break;
      case 'PAYMENT.CAPTURE.COMPLETED':
        console.log('Payment completed:', event.resource.id);
        // Here you can save the donation to your database
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        console.log('Payment denied:', event.resource.id);
        break;
      default:
        console.log('Unhandled event type:', event.event_type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;