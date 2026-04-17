import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing token' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!process.env.SUPABASE_JWT_SECRET) {
       console.error("CRITICAL: SUPABASE_JWT_SECRET is missing. Cannot verify token.");
       return res.status(500).json({ message: 'Internal server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
}
