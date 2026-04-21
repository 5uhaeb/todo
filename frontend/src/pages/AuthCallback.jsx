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
    let timeoutId;
    let subscription;

    async function bounce() {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams((url.hash || '').replace(/^#/, ''));
      const providerError =
        url.searchParams.get('error_description') ||
        url.searchParams.get('error') ||
        hashParams.get('error_description') ||
        hashParams.get('error');

      if (providerError) {
        setError(decodeURIComponent(providerError.replace(/\+/g, ' ')));
        return;
      }

      // Some Supabase OAuth flows return ?code=... and require manual exchange.
      const authCode = url.searchParams.get('code');
      if (authCode) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (cancelled) return;
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        navigate('/dashboard', { replace: true });
        return;
      }

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
      // No session yet; listen for the next auth change.
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          authListener.subscription.unsubscribe();
          navigate('/dashboard', { replace: true });
        }
      });
      subscription = authListener.subscription;

      // Safety net: bail to login after a short wait.
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        if (subscription) subscription.unsubscribe();
        if (!data.session) {
          setError('Sign-in did not complete. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 1500);
        }
      }, 8000);
    }

    bounce();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (subscription) subscription.unsubscribe();
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
