const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const storageKey = "taskflow_session";
export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(storageKey));
    return session?.access_token && session.expires_at > Date.now() / 1000
      ? session
      : null;
  } catch {
    return null;
  }
}
export function setSession(session) {
  if (session) localStorage.setItem(storageKey, JSON.stringify(session));
  else localStorage.removeItem(storageKey);
}
export async function authRequest(path, body, method = "POST") {
  const session = getSession();
  const response = await fetch(base + "/auth" + path, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: "Bearer " + session.access_token } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body || {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || "Authentication request failed");
  return data;
}
let exchanging;
export const authClient = {
  auth: {
    async getSession() {
      return { data: { session: getSession() }, error: null };
    },
    async signInWithPassword(credentials) {
      try {
        const data = await authRequest("/login", credentials);
        setSession(data.session);
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async signOut() {
      try {
        if (getSession()) await authRequest("/logout");
      } finally {
        setSession(null);
      }
    },
    async signInWithOAuth() {
      window.location.assign(base + "/auth/google/start");
      return { error: null };
    },
  },
};
export function exchangeGoogle() {
  if (!exchanging) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token"),
      state = params.get("state");
    const error = params.get("error");
    window.history.replaceState({}, "", "/auth/callback");
    exchanging = (async () => {
      if (error || !token || !state)
        throw new Error(
          "Google sign-in was cancelled or expired. Please try again.",
        );
      const { session } = await authRequest("/google/exchange", {
        token,
        state,
      });
      setSession(session);
      return session;
    })();
  }
  return exchanging;
}
