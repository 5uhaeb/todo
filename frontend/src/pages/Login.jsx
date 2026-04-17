import { useState } from 'react';
import { supabase } from '../supabase.js';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);
    alert('Signup successful. Check email if confirmation is enabled.');
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
    navigate('/dashboard');
  }

  async function googleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    });
  }

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', fontFamily: 'Arial' }}>
      <h2>Todo App Login</h2>
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 10 }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 10 }}
      />
      <button onClick={signUp} style={{ width: '100%', padding: 10, marginBottom: 10 }}>
        Sign Up
      </button>
      <button onClick={signIn} style={{ width: '100%', padding: 10, marginBottom: 10 }}>
        Sign In
      </button>
      <button onClick={googleLogin} style={{ width: '100%', padding: 10 }}>
        Continue with Google
      </button>
    </div>
  );
}
