import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { getPostAuthRedirectPath } from '../auth/mfa.js';
import { getAuthRedirectUrl } from '../auth/redirect.js';

export default function Login() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const isSignUp = mode === 'signup';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();

      if (isSignUp) {
        await supabase.auth.signOut();

        // Sign up. Supabase sends an email containing a 6-digit code
        // (provided the "Confirm signup" email template exposes {{ .Token }}).
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        if (error) {
          setError(error.message);
          return;
        }
        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setError('An account already exists for this email. Please sign in instead.');
          return;
        }
        try {
          sessionStorage.setItem('verify_type', 'signup');
          sessionStorage.setItem('verify_email', cleanEmail);
          sessionStorage.removeItem('verify_source');
        } catch (e) {
          // ignore storage failures
        }
        // Move to the code-entry screen. Pass email through location state.
        navigate('/verify', { state: { email: cleanEmail, verifyType: 'signup' } });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          setError(error.message);
          return;
        }
        navigate(await getPostAuthRedirectPath());
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl(),
        },
      });
      if (error) {
        setError(error.message);
        setGoogleLoading(false);
      }
      // On success the browser is redirected away; nothing else to do.
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
      setGoogleLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="topbar">
        <ThemeToggle />
      </div>

      <div className="login-wrap animate-fade-in">
        <div className="brand-row">
          <span className="brand-square">T</span>
          <h1 className="brand-title">Taskflow</h1>
        </div>
        <p className="brand-subtitle">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </p>

        <div className="card login-card">
          {error && <div className="notice notice-error" role="alert">{error}</div>}

          <button
            type="button"
            className="btn btn-google btn-full"
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{ marginBottom: 12 }}
          >
            <GoogleMark />
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <div className="divider">
            <span className="divider-line" />
            <span className="label-tag">or</span>
            <span className="divider-line" />
          </div>

          <form onSubmit={handleSubmit} className="stack">
            <div>
              <label htmlFor="login-email" className="label-tag">Email</label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ marginTop: 4 }}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="label-tag">Password</label>
              <input
                id="login-password"
                type="password"
                className="input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{ marginTop: 4 }}
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading}
            >
              {loading ? 'Working...' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              id="login-toggle"
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const nextMode = isSignUp ? 'signin' : 'signup';
                setMode(nextMode);
                setEmail('');
                setPassword('');
                setError('');
              }}
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <p className="label-tag footer-tag">Secure - fast - opinionated</p>
      </div>

      <style>{`
        .page-shell {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
        }
        .topbar {
          width: 100%;
          max-width: 720px;
          display: flex;
          justify-content: flex-end;
          margin-bottom: 24px;
        }
        .login-wrap {
          width: 100%;
          max-width: 420px;
          margin: 24px auto 0;
          text-align: center;
        }
        .brand-row {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .brand-title { font-size: 1.75rem; }
        .brand-subtitle {
          color: var(--ink-soft);
          font-size: 0.95rem;
          margin: 0 0 24px;
        }
        .login-card { text-align: left; padding: 24px; }
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 18px 0;
        }
        .divider-line {
          flex: 1;
          height: 2px;
          background: var(--outline);
          opacity: 0.25;
        }
        .footer-tag { margin-top: 24px; }
      `}</style>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.6.27-3.14.76-4.59l-7.98-6.19C.58 16.46 0 20.13 0 24c0 3.87.58 7.54 2.28 10.78l8.25-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-8.25 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}
