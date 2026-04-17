import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';

const router = express.Router();

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(400).json({ message: error.message });
    }

    if (!profile) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: req.user.id,
          email: req.user.email,
          role: 'free'
        })
        .select()
        .single();

      if (insertError) return res.status(400).json({ message: insertError.message });
      return res.json({ user: req.user, profile: inserted });
    }

    res.json({ user: req.user, profile });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
