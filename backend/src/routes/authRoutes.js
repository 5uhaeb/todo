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
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return res.status(400).json({ message: error.message });
    }

    if (!profile) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: req.user.id,
          email: req.user.email,
          role: 'free'
        }, { onConflict: 'id', ignoreDuplicates: true })
        .select()
        .maybeSingle();

      if (insertError) return res.status(400).json({ message: insertError.message });
      if (inserted) return res.json({ user: req.user, profile: inserted, created: true });
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('profiles').select('*').eq('id', req.user.id).single();
      if (existingError) return res.status(500).json({ message: 'Could not load profile' });
      return res.json({ user: req.user, profile: existing, created: false });
    }

    res.json({ user: req.user, profile, created: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
