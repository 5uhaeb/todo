import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabase() {
  const { data, error } = await supabaseAdmin.from('todos').select('*').limit(1);
  if (error) {
    console.error('Database Error:', error.message);
  } else {
    console.log('Database connected, rows:', data);
  }
}

checkDatabase();
