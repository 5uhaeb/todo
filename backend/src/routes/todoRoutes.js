import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';
import redis from '../utils/redis.js';

const router = express.Router();

function cacheKey(userId) {
  return `todos:${userId}`;
}

// Cache helpers — never fail the request because Redis is sad.
async function cacheGet(key) {
  try { return await redis.get(key); }
  catch (err) { console.warn('redis.get failed, falling through to DB:', err.message); return null; }
}
async function cacheSet(key, value, ttlSec = 60) {
  try { await redis.set(key, value, 'EX', ttlSec); }
  catch (err) { console.warn('redis.set failed (ignored):', err.message); }
}
async function cacheDel(key) {
  try { await redis.del(key); }
  catch (err) { console.warn('redis.del failed (ignored):', err.message); }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const key = cacheKey(req.user.id);
    const cached = await cacheGet(key);

    if (cached) {
      return res.json({ source: 'cache', todos: JSON.parse(cached) });
    }

    const { data, error } = await supabaseAdmin
      .from('todos')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    await cacheSet(key, JSON.stringify(data));
    res.json({ source: 'db', todos: data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, priority = 'normal' } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profile?.role !== 'premium' && priority === 'high') {
      return res.status(403).json({ message: 'High priority is premium only' });
    }

    const { count } = await supabaseAdmin
      .from('todos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (profile?.role !== 'premium' && count >= 10) {
      return res.status(403).json({ message: 'Free users can only create 10 tasks' });
    }

    const { data, error } = await supabaseAdmin
      .from('todos')
      .insert({
        user_id: req.user.id,
        title,
        priority
      })
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });

    await cacheDel(cacheKey(req.user.id));
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, completed, priority } = req.body;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (priority === 'high' && profile?.role !== 'premium') {
      return res.status(403).json({ message: 'High priority is premium only' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (completed !== undefined) updateData.completed = completed;
    if (priority !== undefined) updateData.priority = priority;

    const { data, error } = await supabaseAdmin
      .from('todos')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });

    await cacheDel(cacheKey(req.user.id));
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('todos')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(400).json({ message: error.message });

    await cacheDel(cacheKey(req.user.id));
    res.json({ message: 'Todo deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
