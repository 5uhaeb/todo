import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function OAuthConsent() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [params, setParams] = useState({});

  useEffect(() => {
    const url = new URL(window.location.href);
    setParams({
      client_id:     url.searchParams.get('client_id'),
      redirect_uri:  url.searchParams.get('redirect_uri'),
      response_type: url.searchParams.get('response_type'),
      scope:         url.searchParams.get('scope'),
      state:         url.searchParams.get('state'),
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
  }, []);

  function handleApprove() {
    const redirectUrl = new URL(params.redirect_uri);
    if (params.state) redirectUrl.searchParams.set('state', params.state);
    window.location.href = redirectUrl.toString();
  }

  function handleDeny() {
    const redirectUrl = new URL(params.redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    if (params.state) redirectUrl.searchParams.set('state', params.state);
    window.location.href = redirectUrl.toString();
  }

  if (loading) {
    return (
      <div className="consent-shell">
        <div className="spinner" />
        <style>{spinnerCss}</style>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="consent-shell">
        <div className="topbar">
          <ThemeToggle />
        </div>
        <div className="card consent-card animate-fade-in">
          <div className="brand-square" style={{ margin: '0 auto 16px' }}>T</div>
          <h2>Sign in required</h2>
          <p style={{ marginTop: 8 }}>You need to sign in before authorising this application.</p>
          <a href="/" className="btn btn-primary btn-lg btn-full" style={{ marginTop: 16 }}>
            Go to sign in
          </a>
        </div>
        <style>{shellCss}</style>
      </div>
    );
  }

  return (
    <div className="consent-shell">
      <div className="topbar">
        <ThemeToggle />
      </div>

      <div className="card consent-card animate-fade-in">
        <div className="brand-square" style={{ margin: '0 auto 16px' }}>T</div>
        <h2>Authorise application</h2>
        <p style={{ marginTop: 8 }}>
          An application is requesting access to your <strong>Taskflow</strong> account.
        </p>

        {params.client_id && (
          <div className="panel" style={{ textAlign: 'left', marginTop: 20 }}>
            <div className="detail-row">
              <span className="label-tag">App ID</span>
              <span className="detail-value mono">{params.client_id}</span>
            </div>
            {params.scope && (
              <div className="detail-row">
                <span className="label-tag">Scope</span>
                <span className="chip chip-blue">{params.scope}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="label-tag">Redirect</span>
              <span className="detail-value mono">{params.redirect_uri}</span>
            </div>
          </div>
        )}

        <div className="notice notice-info" style={{ marginTop: 16 }}>
          This will let the app access your tasks and profile data.
        </div>

        <div className="button-row">
          <button type="button" className="btn btn-lg" onClick={handleDeny} style={{ flex: 1 }}>
            Deny
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={handleApprove} style={{ flex: 1 }}>
            Authorise
          </button>
        </div>
      </div>

      <style>{shellCss}</style>
    </div>
  );
}

const shellCss = `
.consent-shell {
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
.consent-card {
  width: 100%;
  max-width: 440px;
  padding: 28px 24px;
  text-align: center;
  margin-top: 24px;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--outline);
}
.detail-row:last-child { border-bottom: none; }
.detail-value {
  font-size: 0.8rem;
  color: var(--ink-soft);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.button-row {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
`;

const spinnerCss = `
.consent-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--outline);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
`;
