import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import todoRoutes from './routes/todoRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ 
  origin: function (origin, callback) {
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(value => value.trim());
    callback(null, !origin || allowed.includes(origin));
  }, 
  credentials: true 
}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({ message: 'Todo backend running' });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/payments', paymentRoutes);

app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));
app.use((err, req, res, next) => {
  res.status(err.status === 400 ? 400 : 500).json({ message: err.status === 400 ? 'Invalid request body' : 'Request failed' });
});

export default app;
