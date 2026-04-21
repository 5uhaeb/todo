import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL);

async function test() {
  console.log('🔌 Connecting to Redis Cloud...');
  
  // 1. Test basic write
  await redis.set('test:hello', 'Redis is working!', 'EX', 30);
  console.log('✅ WRITE: Stored "test:hello" → "Redis is working!"');
  
  // 2. Test basic read
  const value = await redis.get('test:hello');
  console.log('✅ READ:', value);

  // 3. Check all existing keys (to see cached todos)
  const keys = await redis.keys('*');
  console.log('\n📦 All keys currently in Redis:');
  if (keys.length === 0) {
    console.log('   (empty — open your Vercel dashboard to trigger a cache)');
  } else {
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      const type = await redis.type(key);
      console.log(`   🔑 ${key}  |  type: ${type}  |  expires in: ${ttl}s`);
      
      if (type === 'string') {
        const val = await redis.get(key);
        // Truncate if long
        const display = val.length > 100 ? val.substring(0, 100) + '...' : val;
        console.log(`      └─ value: ${display}`);
      }
    }
  }

  // Cleanup test key
  await redis.del('test:hello');
  console.log('\n🧹 Cleaned up test key');
  console.log('🎉 Redis Cloud is fully operational!');
  
  redis.disconnect();
}

test().catch(err => {
  console.error('❌ Redis Error:', err.message);
  redis.disconnect();
});
