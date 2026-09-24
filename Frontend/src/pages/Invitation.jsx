import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

const PASSWORD_RULES = [
  (value) => value.length >= 8,
  (value) => /[A-Z]/.test(value),
  (value) => /[a-z]/.test(value),
  (value) => /[0-9]/.test(value),
  (value) => /[!@#$%^&*(),.?":{}|<>_\-\\[\]~`+/;'=]/.test(value),
];

function PasswordVisibilityIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.3A10.7 10.7 0 0 1 12 4c5.2 0 8.7 4.4 9.8 6.2a1.5 1.5 0 0 1 0 1.6 18.5 18.5 0 0 1-3.2 3.8M6.6 6.6A18.6 18.6 0 0 0 2.2 10.2a1.5 1.5 0 0 0 0 1.6C3.3 13.6 6.8 18 12 18c1 0 1.9-.2 2.8-.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.2 10.2a1.5 1.5 0 0 0 0 1.6C3.3 13.6 6.8 18 12 18s8.7-4.4 9.8-6.2a1.5 1.5 0 0 0 0-1.6C20.7 8.4 17.2 4 12 4S3.3 8.4 2.2 10.2Z" />
      <circle cx="12" cy="11" r="3" />
    </svg>
  );
}

export default function Invitation() {
  const { token } = useParams();
  const { acceptInvitationAccount } = useAuth();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmation: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [acceptedOrganization, setAcceptedOrganization] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    let active = true;
    setInvitation(null);
    setError("");
    api.getInvitation(token)
      .then((response) => {
        if (active) setInvitation(response.data || response);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Invitation is unavailable.");
      });
    return () => { active = false; };
  }, [token]);

  async function createAccount(event) {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Name is required.");
    if (!PASSWORD_RULES.every((rule) => rule(form.password))) {
      return setError("Password must include 8 characters, uppercase, lowercase, a number, and a special character.");
    }
    if (form.password !== form.confirmation) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const response = await acceptInvitationAccount(token, {
        name: form.name.trim(),
        password: form.password,
      });
      setAcceptedOrganization(response.data?.organizationId);
      setSuccess(response.message || "Account created and invitation accepted.");
    } catch (requestError) {
      setError(requestError.message || "Unable to create the account.");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = invitation?.role === "admin" ? "Admin" : "User";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>DevFlow invitation</h1>
        {error && <div className="error-box" role="alert">{error}</div>}
        {success && <div className="success-box" role="status">{success}</div>}
        {!invitation && !error && <p className="muted">Loading invitation...</p>}
        {invitation && (
          <>
            <p>You&apos;ve been invited to join <strong>{invitation.organization_name}</strong>.</p>
            <p>Invited email: <strong>{invitation.email}</strong></p>
            <p>Role: <strong>{roleLabel}</strong></p>
            {acceptedOrganization ? (
              <button className="primary-button wide" onClick={() => navigate(`/organizations/${acceptedOrganization}`)}>
                Open organization
              </button>
            ) : (
              <form className="stack-form" onSubmit={createAccount} noValidate>
                {!invitation.account_exists && (
                  <label>
                    Name
                    <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoComplete="name" />
                  </label>
                )}
                <label>
                  {invitation.account_exists ? "Account password" : "Create your password"}
                  <span className="password-input-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(event) => setForm({ ...form, password: event.target.value })}
                      required
                      autoComplete={invitation.account_exists ? "current-password" : "new-password"}
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      <PasswordVisibilityIcon visible={showPassword} />
                    </button>
                  </span>
                </label>
                {!invitation.account_exists && (
                  <label>
                    Confirm password
                    <span className="password-input-wrap">
                      <input
                        type={showConfirmation ? "text" : "password"}
                        value={form.confirmation}
                        onChange={(event) => setForm({ ...form, confirmation: event.target.value })}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        className="password-toggle"
                        type="button"
                        onClick={() => setShowConfirmation((visible) => !visible)}
                        aria-label={showConfirmation ? "Hide password confirmation" : "Show password confirmation"}
                        aria-pressed={showConfirmation}
                      >
                        <PasswordVisibilityIcon visible={showConfirmation} />
                      </button>
                    </span>
                  </label>
                )}
                <button className="primary-button wide" disabled={busy}>
                  {busy ? "Accepting..." : invitation.account_exists ? "Sign in & accept invitation" : "Accept invitation & create account"}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
