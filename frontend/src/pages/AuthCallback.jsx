import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';

/**
 * OAuth landing page. Supabase appends the access token to the URL
 * fragment after a Google sign-in; the JS client picks it up automatically.
 * We just wait for a session and redirect.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function bounce() {
      // Give the supabase client a tick to parse the URL hash.
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        navigate('/dashboard', { replace: true });
        return;
      }
      // No session yet — listen for the next change.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          sub.subscription.unsubscribe();
          navigate('/dashboard', { replace: true });
        }
      });
      // Safety net: bail to login after 5s of no session.
      setTimeout(() => {
        if (cancelled) return;
        sub.subscription.unsubscribe();
        if (!data.session) {
          setError('Sign-in did not complete. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 1500);
        }
      }, 5000);
    }

    bounce();
    return () => { cancelled = true; };
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
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 8 }}>Signing you in…</h2>
            <p>Hang tight, finishing up.</p>
          </>
        )}
      </div>
    </div>
  );
}
