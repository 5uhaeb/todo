import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function test() {
  console.log('Signing up...');
  const { data, error } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@example.com',
    password: 'password123'
  });
  
  if (error) {
    console.error('Signup Error:', error.message);
    return;
  }
  
  console.log('Signup working!', data.user.id);
  
  // Try inserting a todo
  const token = data.session ? data.session.access_token : null;
  console.log('Session token:', token ? 'exists' : 'null');
}

test();
