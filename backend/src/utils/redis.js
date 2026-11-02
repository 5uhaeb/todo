import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  connectTimeout: 2000,
  commandTimeout: 2000,
  retryStrategy(times) {
    // Keep recovering in the background after a cache restart. Commands fail
    // immediately while disconnected so API requests still use the database.
    return Math.min(500 * 2 ** Math.min(times - 1, 6), 30000);
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET'];
    return targetErrors.some(e => err.message.includes(e));
  },
  tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

redis.on('close', () => {
  console.log('⚠️ Redis connection closed');
});

export default redis;
