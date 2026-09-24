import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await api.requestPasswordReset({ email });
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError.message || "Unable to send a reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand centered"><div className="brand-mark">D</div><div><strong>DevFlow</strong><span>Workspace</span></div></div>
        <h1>Forgot password?</h1>
        <p className="muted">Enter your account email and we&apos;ll send you a secure reset link.</p>
        {error && <div className="error-box" role="alert">{error}</div>}
        {message && <div className="success-box" role="status">{message}</div>}
        <label>
          Email
          <input required type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <button className="primary-button wide" disabled={busy}>{busy ? "Sending..." : "Send reset link"}</button>
        <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}
