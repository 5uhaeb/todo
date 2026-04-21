import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    let isMounted = true;
    let redirectTimer;
    let authSubscription;

    function goToDashboard() {
      navigate('/dashboard', { replace: true });
    }

    function fail(message, err) {
      if (err) console.error('OAuth callback failed', err);
      if (isMounted) setError(message);
      redirectTimer = setTimeout(() => navigate('/', { replace: true }), 2200);
    }

    async function run() {
      const search = new URLSearchParams(window.location.search);
      const errorParam = search.get('error');
      const errorDescription = search.get('error_description');

      if (errorParam || errorDescription) {
        fail(errorDescription || errorParam || 'OAuth sign-in failed.');
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        fail(sessionError.message || 'Could not load session.', sessionError);
        return;
      }

      if (data?.session) {
        window.history.replaceState({}, document.title, '/auth/callback');
        goToDashboard();
        return;
      }

      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          window.history.replaceState({}, document.title, '/auth/callback');
          goToDashboard();
        }
      });
      authSubscription = listener.subscription;

      redirectTimer = setTimeout(() => {
        fail('Sign-in did not create a session. Please try again.');
      }, 3500);
    }

    run();

    return () => {
      isMounted = false;
      if (redirectTimer) clearTimeout(redirectTimer);
      if (authSubscription) authSubscription.unsubscribe();
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
