import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../services/api";
import Button from "../components/ui/Button";
import InlineNotice from "../components/ui/InlineNotice";
import PageHeader from "../components/ui/PageHeader";
import SectionCard from "../components/ui/SectionCard";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("profile");
  const [name, setName] = useState(user?.name || "");
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await api.updateProfile({ name: name.trim() });
      setUser(response.data);
      setMessage("Profile updated.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update profile.");
    } finally {
      setBusy(false);
    }
  }

  const sections = [
    { id: "profile", icon: "◌", label: "Profile information" },
    { id: "account", icon: "⚙", label: "Account settings" },
    { id: "appearance", icon: "☼", label: "Appearance" },
    { id: "notifications", icon: "◔", label: "Notifications" },
    { id: "security", icon: "⌁", label: "Security & sessions" },
  ];

  function signOut() {
    logout();
    navigate("/login", { replace: true });
  }

  function renderSection() {
    if (activeSection === "appearance") {
      return (
        <div className="profile-settings-content">
          <span className="profile-card-eyebrow">Appearance</span>
          <h2 className="profile-section-title">Make DevFlow yours</h2>
          <p className="profile-section-description">Choose how DevFlow should look on this device.</p>
          <div className="profile-option-row">
            <div><b>Theme</b><span>Use a light, dark, or system theme.</span></div>
            <select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label="Theme preference">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      );
    }

    if (activeSection === "notifications") {
      return (
        <div className="profile-settings-content">
          <span className="profile-card-eyebrow">Notifications</span>
          <h2 className="profile-section-title">Stay in the loop</h2>
          <p className="profile-section-description">Control which workspace updates reach you.</p>
          <div className="profile-toggle-list">
            <label className="profile-toggle-row"><span><b>Email updates</b><small>Receive summaries about task activity.</small></span><input type="checkbox" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} /></label>
            <label className="profile-toggle-row"><span><b>Desktop notifications</b><small>Show live updates while DevFlow is open.</small></span><input type="checkbox" checked={desktopNotifications} onChange={(event) => setDesktopNotifications(event.target.checked)} /></label>
          </div>
        </div>
      );
    }

    if (activeSection === "security") {
      return (
        <div className="profile-settings-content">
          <span className="profile-card-eyebrow">Security & sessions</span>
          <h2 className="profile-section-title">Your active session</h2>
          <p className="profile-section-description">This browser is signed in through the current DevFlow session.</p>
          <div className="profile-session-row"><span><b>Current browser</b><small>Authenticated session</small></span><span className="profile-session-status">Active</span></div>
          <div className="profile-danger-zone"><div><b>Sign out</b><small>Remove this browser session and return to sign in.</small></div><Button variant="danger" onClick={signOut}>Sign out</Button></div>
        </div>
      );
    }

    if (activeSection === "account") {
      return (
        <div className="profile-settings-content">
          <span className="profile-card-eyebrow">Account settings</span>
          <h2 className="profile-section-title">Account access</h2>
          <p className="profile-section-description">Your account is connected to the workspace permissions shown below.</p>
          <div className="profile-setting-grid">
            <div className="profile-setting-tile"><span className="profile-setting-label">Email</span><span className="profile-setting-value">{user?.email || "Not available"}</span></div>
            <div className="profile-setting-tile"><span className="profile-setting-label">System role</span><span className="profile-setting-value">{user?.role || "User"}</span></div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="profile-card-head">
          <div><span className="profile-card-eyebrow">Profile information</span><h2 className="profile-section-title">Your account</h2></div>
          <div className="profile-avatar" aria-hidden="true">{user?.name?.[0]?.toUpperCase() || "U"}</div>
        </div>
        <form className="stack-form profile-form" onSubmit={saveProfile}>
          <label className="ui-field">Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength="120" required /></label>
          <label className="ui-field">Email<input value={user?.email || ""} disabled aria-label="Email address" /></label>
          <div className="profile-role"><span>System role</span><b>{user?.role || "user"}</b></div>
          <div className="profile-actions"><Button type="submit" loading={busy}>Save name</Button></div>
        </form>
      </>
    );
  }

  return (
    <section className="page profile-page">
      <PageHeader eyebrow="Account" title="Profile" description="Your account details are visible only to you." />

      {error && <InlineNotice>{error}</InlineNotice>}
      {message && <InlineNotice tone="success">{message}</InlineNotice>}

      <div className="profile-settings-layout">
        <aside className="profile-settings-sidebar">
          <div className="profile-settings-title">Settings</div>
          <div className="profile-settings-menu">
            {sections.map((section) => (
              <button key={section.id} type="button" className={`profile-settings-link ${activeSection === section.id ? "active" : ""}`} onClick={() => setActiveSection(section.id)} aria-current={activeSection === section.id ? "page" : undefined}>
                <span aria-hidden="true">{section.icon}</span><span>{section.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <SectionCard className="profile-card profile-settings-card">
          {renderSection()}
        </SectionCard>
      </div>
    </section>
  );
}
