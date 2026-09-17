import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import CommandPalette from "./CommandPalette";
import GlobalAIChat from "./GlobalAIChat";
import "../styles/layout.css";

// Adding a new top-level area now only requires one entry here.
const NAVIGATION = [
  { to: "/overview", label: "Overview", icon: "⌂" },
  { to: "/organizations", label: "Organizations", icon: "◉" },
  { to: "/projects", label: "Projects", icon: "◫" },
  { to: "/tasks", label: "Tasks", icon: "✓" },
  { to: "/knowledge", label: "Knowledge base", icon: "⌕" },
  { to: "/profile", label: "Profile", icon: "◌" },
];

function getPageTitle(pathname) {
  if (pathname.startsWith("/overview")) return "Overview";
  if (pathname.startsWith("/organizations")) return "Organizations";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/tasks")) return "Tasks";
  if (pathname.startsWith("/knowledge")) return "Knowledge";
  if (pathname.startsWith("/profile")) return "Profile";
  return "Workspace";
}

function isDetailPath(pathname) {
  return ["organizations", "projects", "tasks"].some((segment) => (
    new RegExp(`^/${segment}/[^/]+$`).test(pathname)
  ));
}

function getAIContext(pathname) {
  const match = pathname.match(/^\/(organizations|projects|tasks)\/(\d+)$/);
  if (!match) return null;
  return { entityType: match[1].slice(0, -1), entityId: Number(match[2]) };
}

/** Application shell: navigation, live notices, and the global AI assistant. */
export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const pageTitle = getPageTitle(location.pathname);
  const showWorkspaceBreadcrumb = location.pathname !== "/overview"
    && !isDetailPath(location.pathname)
    && NAVIGATION.some((item) => item.to === location.pathname);
  const aiContext = getAIContext(location.pathname);

  useEffect(() => {
    // Tablet/desktop par menu dobara band ho jata hai taake layout stable rahe.
    const closeMenuOnDesktop = () => {
      if (window.innerWidth > 900) setIsMobileMenuOpen(false);
    };

    window.addEventListener("resize", closeMenuOnDesktop);
    return () => window.removeEventListener("resize", closeMenuOnDesktop);
  }, []);

  useEffect(() => {
    // Escape se chhota-screen navigation asani se close ho sakta hai.
    const closeMenuWithEscape = (event) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };

    window.addEventListener("keydown", closeMenuWithEscape);
    return () => window.removeEventListener("keydown", closeMenuWithEscape);
  }, []);

  function handleLogout() {
    logout();
    setIsMobileMenuOpen(false);
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    const token = localStorage.getItem("cms_token");
    if (!token) return undefined;

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5001", {
      auth: { token },
    });

    // Notifications belonging to other users are ignored before they reach UI state.
    socket.on("notification", (notification) => {
      if (notification.userId && Number(notification.userId) !== Number(user?.id)) return;

      const id = `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { ...notification, id }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4500);
    });

    return () => socket.disconnect();
  }, [user?.id]);

  return (
    <div className="app-shell">
      {isMobileMenuOpen && (
        <button className="mobile-scrim" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation menu" />
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <img src="/devflow-logo.svg" alt="DevFlow" />
          </div>
          <div><strong>DevFlow</strong><span>Workspace</span></div>
        </div>

        <div className="workspace-pill"><span className="dot" />Team workspace</div>

        <nav className="nav" aria-label="Workspace navigation">
          {NAVIGATION.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setIsMobileMenuOpen(false)}>
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            className="nav-ai-action"
            onClick={() => { setIsAiOpen(true); setIsMobileMenuOpen(false); }}
            aria-label="Open AI Assistant"
          >
            <span aria-hidden="true">✦</span>
            <span>AI Assistant</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini">
            <div className="avatar">{user?.name?.[0]?.toUpperCase() || "U"}</div>
            <div><strong>{user?.name || "User"}</strong><span>{user?.email || ""}</span></div>
          </div>
          <label className="theme-select">
            <span>Theme</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label="Theme preference">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          <button className="ghost-button" type="button" onClick={handleLogout}>Log out</button>
        </div>
      </aside>

      <main className={`main-content ${isAiOpen ? "main-content--ai-open" : ""}`}>
        <header className="topbar">
          <button
            className="menu-btn"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            ☰
          </button>
          <div className="topbar-title">{pageTitle}</div>
          <div className="cmdk-hint" title="Press Ctrl+K or Cmd+K"><span>⌘</span>K</div>
          <div className="topbar-user">{user?.name}</div>
        </header>

        {showWorkspaceBreadcrumb && (
          <div className="workspace-breadcrumb">
            <NavLink to="/overview" className="breadcrumb-back"><span className="breadcrumb-arrow">←</span><span>Overview</span></NavLink>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-current">{pageTitle}</span>
          </div>
        )}

        <Outlet />
      </main>

      <CommandPalette onOpenAI={() => setIsAiOpen(true)} />

      {!isAiOpen && (
        <button type="button" className="gai-launcher" onClick={() => setIsAiOpen(true)} aria-label="Open AI Assistant" title="AI Assistant">✦</button>
      )}

      <GlobalAIChat
        open={isAiOpen}
        sessionId={null}
        context={aiContext}
        onClose={() => setIsAiOpen(false)}
        onMinimize={() => setIsAiOpen(false)}
      />

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <b>{toast.title || "Notification"}</b>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
