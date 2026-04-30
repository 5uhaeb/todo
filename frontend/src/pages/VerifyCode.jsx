import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { getPostAuthRedirectPath } from '../auth/mfa.js';

const OTP_LENGTH = 8;

/**
 * Code-entry screen for first-time signup.
 * The user lands here after Login.jsx calls supabase.auth.signUp().
 * Supabase emails them a token; they enter it here to confirm
 * their email and create a session.
 *
 * Requires the Supabase project's "Confirm signup" email template to
 * surface {{ .Token }} (see SETUP_AUTH.md for one-time setup).
 */
export default function VerifyCode() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateVerifyType = location.state?.verifyType;
  const stateSource = location.state?.source;
  const storedVerifyType = typeof window !== 'undefined' ? sessionStorage.getItem('verify_type') : null;
  const storedSource = typeof window !== 'undefined' ? sessionStorage.getItem('verify_source') : null;
  const storedEmail = typeof window !== 'undefined' ? sessionStorage.getItem('verify_email') : null;
  const verifyType = stateVerifyType || storedVerifyType || 'signup';
  const isOAuthVerify = (stateSource || storedSource) === 'oauth';

  const [email, setEmail] = useState(location.state?.email || storedEmail || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (verifyType === 'signup') return;

    supabase.auth.getUser().then(async ({ data }) => {
      const provider = data.user?.app_metadata?.provider;
      if (provider && provider !== 'email') {
        navigate(await getPostAuthRedirectPath(), { replace: true });
      }
    });
  }, [navigate, verifyType]);

  // If they refresh and lose state, let them type the email manually.
  useEffect(() => {
    if (!email) setInfo(`Enter the email you signed up with, then the ${OTP_LENGTH}-digit code we sent.`);
  }, [email]);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: verifyType,
      });
      if (error) {
        setError(error.message);
        return;
      }
      if (data?.session) {
        try {
          sessionStorage.removeItem('verify_type');
          sessionStorage.removeItem('verify_source');
          sessionStorage.removeItem('verify_email');
        } catch (e) {
          // ignore storage failures
        }
        navigate(await getPostAuthRedirectPath());
      } else {
        // Some Supabase setups return user but no session if confirmation
        // is configured differently. Send them to sign-in either way.
        setInfo('Account confirmed. Please sign in.');
        setTimeout(() => navigate('/'), 1200);
      }
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      setError('Enter your email first.');
      return;
    }
    setError('');
    setInfo('');
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: verifyType,
        email,
      });
      if (error) {
        setError(error.message);
      } else {
        setInfo('A new code is on its way.');
      }
    } catch (err) {
      setError(err.message || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="topbar">
        <ThemeToggle />
      </div>

      <div className="verify-wrap animate-fade-in">
        <div className="brand-row">
          <span className="brand-square">T</span>
          <h1 className="brand-title">Verify your email</h1>
        </div>
        <p className="brand-subtitle">
          We sent a {OTP_LENGTH}-digit code to <strong>{email || 'your inbox'}</strong>.
          Enter it below to {isOAuthVerify ? 'finish Google sign-in' : 'finish setting up your account'}.
        </p>

        <div className="card verify-card">
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {info && <div className="notice notice-info">{info}</div>}

          <form onSubmit={handleVerify} className="stack">
            {!location.state?.email && (
              <div>
                <label htmlFor="verify-email" className="label-tag">Email</label>
                <input
                  id="verify-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{ marginTop: 4 }}
                />
              </div>
            )}

            <div>
              <label htmlFor="verify-code" className="label-tag">{OTP_LENGTH}-digit code</label>
              <input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input input-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                placeholder="00000000"
                required
                style={{ marginTop: 4 }}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading || code.length !== OTP_LENGTH}
            >
              {loading ? 'Verifying...' : 'Verify and continue'}
            </button>
          </form>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                try {
                  sessionStorage.removeItem('verify_type');
                  sessionStorage.removeItem('verify_source');
                  sessionStorage.removeItem('verify_email');
                } catch (e) {
                  // ignore storage failures
                }
                navigate('/');
              }}
            >
              Back to sign in
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? 'Sending...' : 'Resend code'}
            </button>
          </div>
        </div>
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
        .verify-wrap { width: 100%; max-width: 460px; margin: 24px auto 0; text-align: center; }
        .brand-row { display: inline-flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .brand-title { font-size: 1.5rem; }
        .brand-subtitle { color: var(--ink-soft); font-size: 0.95rem; margin: 0 0 24px; }
        .verify-card { text-align: left; padding: 24px; }
      `}</style>
    </div>
  );
}
