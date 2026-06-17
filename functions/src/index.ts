import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const createPaymentIntent = onCall(
  { region: 'asia-southeast1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to make a payment.');
    }

    const { amount, metadata = {} } = request.data as {
      amount: number;
      metadata?: Record<string, string>;
    };

    if (!amount || amount <= 0) {
      throw new HttpsError('invalid-argument', 'Invalid payment amount.');
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert RM to sen (smallest unit)
      currency: 'myr',
      metadata: {
        ...metadata,
        userId: request.auth.uid,
      },
      automatic_payment_methods: { enabled: true },
    });

    return { clientSecret: paymentIntent.client_secret };
  }
);
