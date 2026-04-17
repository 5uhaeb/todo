import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

export default function OAuthConsent() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [params, setParams] = useState({});

  useEffect(() => {
    const url = new URL(window.location.href);
    const queryParams = {
      client_id: url.searchParams.get('client_id'),
      redirect_uri: url.searchParams.get('redirect_uri'),
      response_type: url.searchParams.get('response_type'),
      scope: url.searchParams.get('scope'),
      state: url.searchParams.get('state'),
    };
    setParams(queryParams);

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
  }, []);

  async function handleApprove() {
    // Build the redirect with the authorization code
    const redirectUrl = new URL(params.redirect_uri);
    if (params.state) redirectUrl.searchParams.set('state', params.state);
    
    // Supabase handles the token exchange; redirect back with session
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
      <div style={styles.page}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.card} className="card-glass animate-fade-in">
          <div style={styles.logoIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <h2 style={styles.title}>Sign In Required</h2>
          <p style={styles.desc}>You need to sign in before authorizing this application.</p>
          <a href="/" className="btn btn-primary btn-full btn-lg" style={{ textDecoration: 'none', marginTop: 16 }}>
            Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card} className="card-glass animate-fade-in">
        <div style={styles.logoIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <h2 style={styles.title}>Authorize Application</h2>
        <p style={styles.desc}>
          An application is requesting access to your <strong>Taskflow</strong> account.
        </p>

        {params.client_id && (
          <div style={styles.detailCard}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>App ID</span>
              <span style={styles.detailValue}>{params.client_id}</span>
            </div>
            {params.scope && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Scope</span>
                <span className="badge badge-normal">{params.scope}</span>
              </div>
            )}
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Redirect</span>
              <span style={styles.detailValue}>{params.redirect_uri}</span>
            </div>
          </div>
        )}

        <p style={styles.warning}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          This will allow the app to access your tasks and profile data.
        </p>

        <div style={styles.buttonRow}>
          <button className="btn btn-secondary btn-lg" onClick={handleDeny} style={{ flex: 1 }}>
            Deny
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleApprove} style={{ flex: 1 }}>
            Authorize
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(108,99,255,0.2)',
    borderTopColor: '#6c63ff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px 32px',
    textAlign: 'center',
  },
  logoIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    margin: '0 auto 20px',
    boxShadow: '0 0 30px rgba(108,99,255,0.3)',
  },
  title: {
    fontSize: '1.375rem',
    fontWeight: '700',
    marginBottom: '8px',
    color: '#f0f0f5',
  },
  desc: {
    color: '#9ca3af',
    fontSize: '0.9rem',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  detailCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
    textAlign: 'left',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  detailLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  detailValue: {
    fontSize: '0.8rem',
    color: '#d1d5db',
    maxWidth: '220px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  warning: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    fontSize: '0.8rem',
    color: '#fbbf24',
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: '10px',
    marginBottom: '24px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
  },
};
