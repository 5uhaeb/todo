export function getAuthRedirectUrl() {
  return import.meta.env.VITE_AUTH_REDIRECT_URL || `${window.location.origin}/auth/callback`;
}
