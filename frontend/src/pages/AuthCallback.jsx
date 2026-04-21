import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import api from '../api/axios.js';

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
      const code = url.searchParams.get('code');

      if (errorParam || errorDescription) {
        const rawMessage = errorDescription || errorParam || 'OAuth sign-in failed.';
        const looksLikeGoogleAuthCode = /^4\/0[a-zA-Z0-9._-]+/.test(rawMessage);
        const message = looksLikeGoogleAuthCode
          ? 'Google sign-in code was rejected. Please try signing in again.'
          : rawMessage;
        if (isMounted) setError(message);
        redirectTimer = setTimeout(() => navigate('/', { replace: true }), 1800);
        return;
      }

      // In browser clients, Supabase may already auto-detect/exchange callback codes.
      // Only exchange manually when there is a code and no existing session.
      let { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        if (isMounted) setError(sessionError.message || 'Could not load session.');
        redirectTimer = setTimeout(() => navigate('/', { replace: true }), 1800);
        return;
      }

      if (!data?.session && code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const rawMessage = exchangeError.message || 'Could not complete sign-in.';
          const looksLikeGoogleAuthCode = /^4\/0[a-zA-Z0-9._-]+/.test(rawMessage);
          if (isMounted) {
            setError(
              looksLikeGoogleAuthCode
                ? 'Google sign-in code was rejected. Please try again.'
                : rawMessage
            );
          }
          redirectTimer = setTimeout(() => navigate('/', { replace: true }), 2200);
          return;
        }
        window.history.replaceState({}, document.title, '/auth/callback');

        const next = await supabase.auth.getSession();
        data = next.data;
      }

      if (data?.session) {
        const provider = data.session.user?.app_metadata?.provider;
        try {
          const me = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          const isFirstOAuthLogin = provider === 'google' && me?.data?.created;

          if (isFirstOAuthLogin) {
            const email = data.session.user?.email;
            if (!email) throw new Error('No email found on your Google account.');

            const { error: otpError } = await supabase.auth.signInWithOtp({
              email,
              options: {
                shouldCreateUser: false,
              },
            });
            if (otpError) throw otpError;

            await supabase.auth.signOut();
            try {
              sessionStorage.setItem('verify_type', 'email');
              sessionStorage.setItem('verify_source', 'oauth');
              sessionStorage.setItem('verify_email', email);
            } catch (e) {
              // ignore storage failures
            }
            navigate('/verify', {
              replace: true,
              state: {
                email,
                verifyType: 'email',
                source: 'oauth',
              },
            });
            return;
          }
        } catch (flowError) {
          if (isMounted) {
            setError(flowError.message || 'Could not start email verification.');
          }
          redirectTimer = setTimeout(() => navigate('/', { replace: true }), 2200);
          return;
        }

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
