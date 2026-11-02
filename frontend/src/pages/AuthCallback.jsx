import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { getPostAuthRedirectPath } from '../auth/mfa.js';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timers = new Set();
    const schedule = (fn, ms = 0) => {
      const timer = setTimeout(() => { timers.delete(timer); if (active) fn(); }, ms);
      timers.add(timer);
    };
    const fail = message => { if (active) setError(message); };
    const finish = async () => {
      try {
        const path = await getPostAuthRedirectPath();
        if (!active) return;
        for (const timer of timers) clearTimeout(timer);
        window.history.replaceState({}, document.title, '/auth/callback');
        navigate(path, { replace: true });
      } catch (err) { fail(err.message || 'Could not finish sign-in.'); }
    };
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const authError = search.get('error_description') || hash.get('error_description') ||
      search.get('error') || hash.get('error');
    if (authError) {
      fail(authError);
      return () => { active = false; };
    }
    // Keep Supabase API calls outside its synchronous auth event callback.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && ['SIGNED_IN', 'INITIAL_SESSION'].includes(event)) schedule(finish);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) fail(error.message);
      else if (data.session) schedule(finish);
    }).catch(err => fail(err.message));
    schedule(() => fail('Sign-in did not create a session. Please return to sign in and try again.'), 15000);
    return () => {
      active = false;
      for (const timer of timers) clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div className="card animate-fade-in" style={{ textAlign: 'center', maxWidth: 360 }}>
        {error ? (
          <>
            <h2 style={{ marginBottom: 8 }}>Sign-in failed</h2>
            <p>{error}</p>
            <a href="/" className="btn btn-primary" style={{ marginTop: 16 }}>Return to sign in</a>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 8 }}>Signing you in...</h2>
            <p>Hang tight, finishing up.</p>
          </>
        )}
      </div>
    </div>
  );
}
