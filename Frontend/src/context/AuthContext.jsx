// Import React functions.
//
// createContext → creates a global authentication context.
// useContext   → allows components to access the context.
// useEffect    → runs code when the component starts.
// useState     → creates and manages state.
import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";


// Import API functions.
//
// api.login()  → login request
// api.signup() → signup request
// api.me()     → get current logged-in user
import { api } from "../services/api";
import {
  claimTabLock,
  hasActiveTabLock,
  releaseTabLock,
  subscribeToTabLock,
} from "../services/singleTabSession";


// Create the Authentication Context.
//
// This context will store authentication information
// that can be accessed by different components.
const AuthContext = createContext(null);


// ======================================================
// AUTH PROVIDER
// ======================================================

// AuthProvider provides authentication information
// to all components inside it.
//
// children means all components placed inside AuthProvider.
export function AuthProvider({ children }) {

  // Store the currently logged-in user.
  //
  // Initially there is no user.
  const [user, setUser] = useState(null);


  // Store whether we are checking authentication.
  //
  // true  → authentication check is running
  // false → authentication check is finished
  const [loading, setLoading] = useState(true);
  const [sessionLocked, setSessionLocked] = useState(false);

  async function establishSession(response) {
    const nextUser = response.data.user;
    if (!claimTabLock(nextUser.id)) {
      localStorage.removeItem("cms_token");
      throw new Error("DevFlow is already open in another tab. Please continue using the existing DevFlow tab.");
    }
    setSessionLocked(false);
    setUser(nextUser);
    return response;
  }


  // ======================================================
  // CHECK LOGIN WHEN APP STARTS
  // ======================================================

  // useEffect runs once when AuthProvider starts.
  //
  // [] means:
  // "Run this code only when the component first loads."
  useEffect(() => {

    // Check whether a JWT token exists in localStorage.
    //
    // If there is no token,
    // the user is not logged in.
    if (!localStorage.getItem("cms_token")) {
      setLoading(false);
      return;
    }


    // A token exists.
    //
    // Ask the backend:
    // "Who is the user belonging to this token?"
    api.me()

      // If the token is valid,
      // save the user information in state.
      .then((response) => {
        if (claimTabLock(response.data.id)) {
          setSessionLocked(false);
          setUser(response.data);
        } else {
          setSessionLocked(true);
          setUser(response.data);
        }
      })


      // If the request fails,
      // the token may be invalid or expired.
      .catch(() => {

        // Remove the invalid token
        // from localStorage.
        localStorage.removeItem("cms_token");
        releaseTabLock();
        setUser(null);
      })


      // This runs whether the request succeeds or fails.
      //
      // Authentication checking is now finished.
      .finally(() => {
        setLoading(false);
      });

  }, []);

  useEffect(() => subscribeToTabLock(() => {
    if (!user) return;
    if (!localStorage.getItem("cms_token")) {
      setUser(null);
      setSessionLocked(false);
      return;
    }
    if (claimTabLock(user.id)) {
      setSessionLocked(false);
    } else {
      setSessionLocked(true);
    }
  }), [user]);


  // ======================================================
  // RESYNC ACROSS BROWSER TABS
  // ======================================================

  // If the token changes in another tab (login as a different
  // user, or logout there), this tab's `user` state would
  // otherwise stay stale while api.js silently starts using the
  // new token for every request. Listen for the storage event
  // (fires only in OTHER tabs, never the one that made the
  // change) and resync.
  useEffect(() => {

    function handleStorageChange(event) {

      // Ignore changes to unrelated localStorage keys.
      if (event.key !== "cms_token") {
        return;
      }

      // Token was removed in another tab → log out here too.
      if (!event.newValue) {
        setUser(null);
        return;
      }

      // Token changed to a new value → re-check who it belongs to,
      // same call used on initial app load.
      api.me()
        .then((response) => {
          setUser(response.data);
        })
        .catch(() => {
          setUser(null);
        });
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);

  }, []);


  // ======================================================
  // LOGIN FUNCTION
  // ======================================================

  // This function is called when the user logs in.
  async function login(data) {
    if (hasActiveTabLock()) {
      throw new Error("DevFlow is already open in another tab. Please continue using the existing DevFlow tab.");
    }

    // Send login information to the backend.
    //
    // data may contain:
    // {
    //   email,
    //   password
    // }
    const response = await api.login(data);


    // Save the JWT token in localStorage.
    //
    // The token will be used for future protected API requests.
    localStorage.setItem("cms_token", response.data.token);
    await establishSession(response);
  }


  // ======================================================
  // SIGNUP FUNCTION
  // ======================================================

  // This function is called when a new user signs up.
  async function signup(data) {
    if (hasActiveTabLock()) {
      throw new Error("DevFlow is already open in another tab. Please continue using the existing DevFlow tab.");
    }

    // Send signup information to the backend.
    const response = await api.signup(data);


    // Save the JWT token returned by the backend.
    localStorage.setItem("cms_token", response.data.token);
    await establishSession(response);
  }

  async function acceptInvitationAccount(token, data) {
    if (hasActiveTabLock()) {
      throw new Error("DevFlow is already open in another tab. Please continue using the existing DevFlow tab.");
    }
    const response = await api.acceptInvitationAndCreateAccount(token, data);
    localStorage.setItem("cms_token", response.data.token);
    await establishSession(response);
    return response;
  }


  // ======================================================
  // LOGOUT FUNCTION
  // ======================================================

  // This function logs the user out.
  async function logout() {
    try {
      if (localStorage.getItem("cms_token")) {
        await api.logout();
      }
    } catch (error) {
      // Local cleanup still prevents use of the session in this browser if the
      // backend is unavailable; the server reports errors for authenticated requests.
      console.error("Logout request failed:", error);
    } finally {
      localStorage.removeItem("cms_token");
      localStorage.removeItem("cms_session_user");
      releaseTabLock();
      setUser(null);
      setSessionLocked(false);
    }
  }


  // ======================================================
  // PROVIDE AUTH DATA
  // ======================================================

  // Make authentication data and functions
  // available to all child components.
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionLocked,
        login,
        signup,
        acceptInvitationAccount,
        logout,
        setUser
      }}
    >

      {/* Render all components inside AuthProvider */}
      {children}

    </AuthContext.Provider>
  );
}


// ======================================================
// useAuth CUSTOM HOOK
// ======================================================

// This custom hook makes it easier for components
// to access AuthContext.
//
// Instead of writing:
// useContext(AuthContext)
//
// we can simply write:
// useAuth()
export function useAuth() {

  // Return the current authentication context.
  return useContext(AuthContext);
}
