import express from 'express';
import Razorpay from 'razorpay';
import { authMiddleware } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 9900,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`
    });

    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/verify', authMiddleware, async (req, res) => {
  try {
    await supabaseAdmin
      .from('profiles')
      .update({ role: 'premium' })
      .eq('id', req.user.id);

    res.json({ message: 'Premium activated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
