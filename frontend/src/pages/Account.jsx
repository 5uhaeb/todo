import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { authRequest, getSession, setSession } from "../auth/client.js";
export default function Account() {
  const [session, updateSession] = useState(getSession());
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!session) return <Navigate to="/" replace />;
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authRequest(
        "/password",
        { password, currentPassword },
        "PUT",
      );
      setSession(result.session);
      updateSession(result.session);
      setPassword("");
      setCurrentPassword("");
      setMessage("Password saved. Your other sessions have been signed out.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      className="card"
      style={{ maxWidth: 480, margin: "60px auto", padding: 24 }}
    >
      <h1>Account</h1>
      <p>{session.user.email}</p>
      <p>
        Google sign-in stays available. You can also set a password for email
        and password sign-in.
      </p>
      <form className="stack" onSubmit={save}>
        {session.user.hasPassword && (
          <label>
            Current password
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
        )}
        <label>
          New password
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving..." : "Save password"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <p>
        <Link to="/dashboard">Continue to your tasks</Link>
      </p>
    </main>
  );
}
