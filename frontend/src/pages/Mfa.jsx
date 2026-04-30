import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { LOCAL_MFA_ENABLED } from '../auth/mfa.js';

const CODE_LENGTH = 6;

export default function Mfa() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('loading');
  const [factorId, setFactorId] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const title = useMemo(() => {
    if (mode === 'enroll') return 'Set up local MFA';
    if (mode === 'challenge') return 'Verify MFA code';
    return 'Checking MFA';
  }, [mode]);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setError('');
    setMode('loading');

    try {
      if (!LOCAL_MFA_ENABLED) {
        navigate('/dashboard', { replace: true });
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate('/', { replace: true });
        return;
      }

      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.error) throw aal.error;
      if (aal.data?.currentLevel === 'aal2') {
        navigate('/dashboard', { replace: true });
        return;
      }

      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const verifiedTotp = factors.data?.totp?.find((factor) => factor.status === 'verified');
      if (verifiedTotp) {
        setFactorId(verifiedTotp.id);
        setMode('challenge');
        return;
      }

      const enrollment = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Taskflow local',
      });
      if (enrollment.error) throw enrollment.error;

      setFactorId(enrollment.data.id);
      setQr(enrollment.data.totp.qr_code);
      setSecret(enrollment.data.totp.secret || '');
      setMode('enroll');
    } catch (err) {
      setError(err.message || 'Could not prepare MFA.');
      setMode('error');
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    if (!factorId || code.length !== CODE_LENGTH) return;

    setError('');
    setLoading(true);

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verify.error) throw verify.error;

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'MFA verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="page-shell">
      <div className="topbar">
        <ThemeToggle />
      </div>

      <div className="mfa-wrap animate-fade-in">
        <div className="brand-row">
          <span className="brand-square">T</span>
          <h1 className="brand-title">{title}</h1>
        </div>
        <p className="brand-subtitle">
          {mode === 'enroll'
            ? 'Scan the QR code with an authenticator app, then enter the 6-digit code.'
            : 'Enter the 6-digit code from your authenticator app to continue.'}
        </p>

        <div className="card mfa-card">
          {error && <div className="notice notice-error" role="alert">{error}</div>}

          {mode === 'loading' && (
            <div className="mfa-loading">
              <div className="loading-spinner" />
              <p>Checking your session...</p>
            </div>
          )}

          {mode === 'enroll' && qr && (
            <div className="qr-panel">
              <img
                className="qr-image"
                src={qr}
                alt="Authenticator app QR code"
              />
              {secret && (
                <div className="secret-box">
                  <span className="label-tag">Manual code</span>
                  <code>{secret}</code>
                </div>
              )}
            </div>
          )}

          {(mode === 'enroll' || mode === 'challenge') && (
            <form onSubmit={verifyCode} className="stack">
              <div>
                <label htmlFor="mfa-code" className="label-tag">Authenticator code</label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input input-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                  placeholder="000000"
                  required
                  autoFocus
                  style={{ marginTop: 4 }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={loading || code.length !== CODE_LENGTH}
              >
                {loading ? 'Verifying...' : mode === 'enroll' ? 'Enable MFA' : 'Verify and continue'}
              </button>
            </form>
          )}

          <div className="mfa-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>
              Back to sign in
            </button>
            {mode === 'error' && (
              <button type="button" className="btn btn-sm" onClick={init}>
                Try again
              </button>
            )}
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
        .mfa-wrap {
          width: 100%;
          max-width: 460px;
          margin: 24px auto 0;
          text-align: center;
        }
        .brand-row {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .brand-title { font-size: 1.5rem; }
        .brand-subtitle {
          color: var(--ink-soft);
          font-size: 0.95rem;
          margin: 0 0 24px;
        }
        .mfa-card {
          text-align: left;
          padding: 24px;
        }
        .mfa-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
          padding: 24px 0;
        }
        .qr-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
        }
        .qr-image {
          width: min(100%, 240px);
          aspect-ratio: 1;
          background: #fff;
          border: var(--outline-thin) solid var(--outline);
          border-radius: var(--radius-sm);
          padding: 10px;
        }
        .secret-box {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .secret-box code {
          display: block;
          overflow-wrap: anywhere;
          padding: 10px 12px;
          border: var(--outline-thin) solid var(--outline);
          border-radius: var(--radius-sm);
          background: var(--input-bg);
          color: var(--ink);
        }
        .mfa-actions {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-top: 16px;
        }
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--outline);
          border-top-color: var(--green);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
      `}</style>
    </div>
  );
}
