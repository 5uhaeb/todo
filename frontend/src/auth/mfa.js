import { supabase } from '../supabase.js';

export const LOCAL_MFA_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_LOCAL_MFA === 'true';

export async function getPostAuthRedirectPath() {
  if (!LOCAL_MFA_ENABLED) return '/dashboard';

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;

  return data?.currentLevel === 'aal2' ? '/dashboard' : '/mfa';
}

export async function requiresLocalMfaVerification() {
  if (!LOCAL_MFA_ENABLED) return false;

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;

  return data?.currentLevel !== 'aal2';
}
