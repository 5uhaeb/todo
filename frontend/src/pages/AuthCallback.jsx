import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeGoogle } from "../auth/client.js";
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    exchangeGoogle()
      .then((session) => {
        if (active)
          navigate(session.user.hasPassword ? "/dashboard" : "/account", {
            replace: true,
          });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [navigate]);
  return (
    <main
      className="card"
      style={{ maxWidth: 460, margin: "80px auto", padding: 24 }}
    >
      <h1>{error ? "Sign-in failed" : "Signing you in..."}</h1>
      {error && (
        <>
          <p role="alert">{error}</p>
          <a href="/">Return to sign in</a>
        </>
      )}
    </main>
  );
}
