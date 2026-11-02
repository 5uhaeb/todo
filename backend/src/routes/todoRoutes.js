import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { supabaseAdmin } from '../utils/supabase.js';
import redis from '../utils/redis.js';

const router = express.Router();
const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('id', (req, res, next, id) => {
  if (!validId.test(id)) return res.status(400).json({ message: 'Invalid task ID' });
  next();
});
function invalidTask(body, partial = false) {
  if ((!partial || body.title !== undefined) &&
      (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 500)) return 'Title must contain 1 to 500 characters';
  if (body.priority !== undefined && !['low', 'normal', 'high'].includes(body.priority)) return 'Invalid priority';
  if (body.completed !== undefined && typeof body.completed !== 'boolean') return 'Completed must be a boolean';
  if (partial && !['title', 'priority', 'completed'].some(key => body[key] !== undefined)) return 'No task changes supplied';
  return null;
}

function cacheKey(userId) {
  return `todos:${userId}`;
}

// Cache helpers; never fail the request because Redis is unavailable.
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

    if (error) return res.status(error.code === '23514' && /premium|10 tasks/.test(error.message) ? 403 : 400).json({ message: error.message });

    await cacheSet(key, JSON.stringify(data));
    res.json({ source: 'db', todos: data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, priority = 'normal' } = req.body;

    const invalid = invalidTask(req.body);
    if (invalid) return res.status(400).json({ message: invalid });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profileError) return res.status(500).json({ message: 'Could not check account plan' });
    if (profile?.role !== 'premium' && priority === 'high') {
      return res.status(403).json({ message: 'High priority is premium only' });
    }

    const { count, error: countError } = await supabaseAdmin
      .from('todos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (countError) return res.status(500).json({ message: 'Could not check task limit' });
    if (profile?.role !== 'premium' && count >= 10) {
      return res.status(403).json({ message: 'Free users can only create 10 tasks' });
    }

    const { data, error } = await supabaseAdmin
      .from('todos')
      .insert({
        user_id: req.user.id,
        title: title.trim(),
        priority
      })
      .select()
      .single();

    if (error) return res.status(error.code === '23514' && /premium|10 tasks/.test(error.message) ? 403 : 400).json({ message: error.message });

    await cacheDel(cacheKey(req.user.id));
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, completed, priority } = req.body;
    const invalid = invalidTask(req.body, true);
    if (invalid) return res.status(400).json({ message: invalid });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (profileError) return res.status(500).json({ message: 'Could not check account plan' });
    if (priority === 'high' && profile?.role !== 'premium') {
      return res.status(403).json({ message: 'High priority is premium only' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (completed !== undefined) updateData.completed = completed;
    if (priority !== undefined) updateData.priority = priority;

    const { data, error } = await supabaseAdmin
      .from('todos')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return res.status(error.code === '23514' && /premium|10 tasks/.test(error.message) ? 403 : 400).json({ message: error.message });

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

    if (error) return res.status(error.code === '23514' && /premium|10 tasks/.test(error.message) ? 403 : 400).json({ message: error.message });

    await cacheDel(cacheKey(req.user.id));
    res.json({ message: 'Todo deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
