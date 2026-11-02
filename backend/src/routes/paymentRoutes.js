import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

export function createPaymentRouter({ gateway, db = supabaseAdmin, secret = process.env.RAZORPAY_KEY_SECRET, key = process.env.RAZORPAY_KEY_ID, authenticate = authMiddleware } = {}) {
  const router = express.Router();
  router.use(authenticate);
  router.use((req, res, next) => {
    if (!gateway || !secret) return res.status(503).json({ message: 'Payments are temporarily unavailable' });
    next();
  });
  router.post('/create-order', async (req, res) => {
    try {
      const order = await gateway.orders.create({
        amount: 9900, currency: 'INR', receipt: `rcpt_${crypto.randomUUID().slice(0, 24)}`,
        notes: { user_id: req.user.id },
      });
      res.json({ key, order });
    } catch (error) {
      res.status(502).json({ message: 'Could not create checkout order' });
    }
  });
  router.post('/verify', async (req, res) => {
    try {
      const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
      if (![orderId, paymentId, signature].every(value => typeof value === 'string' && value.length > 0) || !/^[a-f0-9]{64}$/i.test(signature)) {
        return res.status(400).json({ message: 'Invalid payment details' });
      }
      const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest();
      if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
        return res.status(400).json({ message: 'Payment verification failed: Invalid signature' });
      }
      const [order, payment] = await Promise.all([gateway.orders.fetch(orderId), gateway.payments.fetch(paymentId)]);
      if (order.notes?.user_id !== req.user.id || order.amount !== 9900 || order.currency !== 'INR' ||
          payment.order_id !== orderId || payment.amount !== 9900 || payment.currency !== 'INR' || payment.status !== 'captured') {
        return res.status(400).json({ message: 'Payment is not a captured premium purchase for this account' });
      }
      const { data, error } = await db.from('profiles').update({ role: 'premium' }).eq('id', req.user.id).select('id').maybeSingle();
      if (error || !data) return res.status(500).json({ message: 'Could not activate premium. Please retry verification.' });
      res.json({ message: 'Premium activated' });
    } catch (error) {
      res.status(502).json({ message: 'Could not verify payment. Please retry.' });
    }
  });
  return router;
}
const configured = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET;
export default createPaymentRouter({ gateway: configured ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) : null });
