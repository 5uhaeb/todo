import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    let redirectTimer;

    async function run() {
      const url = new URL(window.location.href);
      const errorParam = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (errorParam || errorDescription) {
        const message = errorDescription || errorParam || 'OAuth sign-in failed.';
        if (isMounted) setError(message);
        redirectTimer = setTimeout(() => navigate('/', { replace: true }), 1800);
        return;
      }

      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (isMounted) setError(exchangeError.message || 'Could not complete sign-in.');
          redirectTimer = setTimeout(() => navigate('/', { replace: true }), 1800);
          return;
        }
        window.history.replaceState({}, document.title, '/auth/callback');
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        if (isMounted) setError(sessionError.message || 'Could not load session.');
        redirectTimer = setTimeout(() => navigate('/', { replace: true }), 1800);
        return;
      }

      if (data?.session) {
        navigate('/dashboard', { replace: true });
        return;
      }

      if (isMounted) setError('Sign-in did not create a session. Please try again.');
      redirectTimer = setTimeout(() => navigate('/', { replace: true }), 1800);
    }

    run();

    return () => {
      isMounted = false;
      if (redirectTimer) clearTimeout(redirectTimer);
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
