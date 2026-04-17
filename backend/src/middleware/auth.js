import { supabaseAdmin } from '../utils/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing token' });
    }

    const token = authHeader.split(' ')[1];
    
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      console.error('Supabase auth failed:', error?.message);
      return res.status(401).json({ message: 'Auth failed: ' + (error?.message || 'No user found') });
    }
    
    req.user = {
      id: user.id,
      email: user.email
    };
    
    next();
  } catch (error) {
    console.error('Auth Middleware Exception:', error.message);
    return res.status(401).json({ message: 'Exception: ' + error.message });
  }
}
