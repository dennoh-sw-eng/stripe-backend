const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config(); // <-- Load .env variables

const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // <-- Use secret from .env

const app = express();
app.use(cors());
app.use(express.json());

app.post('/create-payment-intent', async (req, res) => {
  const { amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Stripe backend running at http://localhost:${PORT}`);
});
