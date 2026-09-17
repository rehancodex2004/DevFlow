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

      // Authentication checking is finished.
      setLoading(false);

      // Stop here.
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
        setUser(response.data);
      })


      // If the request fails,
      // the token may be invalid or expired.
      .catch(() => {

        // Remove the invalid token
        // from localStorage.
        localStorage.removeItem("cms_token");
      })


      // This runs whether the request succeeds or fails.
      //
      // Authentication checking is now finished.
      .finally(() => {
        setLoading(false);
      });

  }, []);


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
    localStorage.setItem(
      "cms_token",
      response.data.token
    );


    // Save the logged-in user in React state.
    setUser(response.data.user);
  }


  // ======================================================
  // SIGNUP FUNCTION
  // ======================================================

  // This function is called when a new user signs up.
  async function signup(data) {

    // Send signup information to the backend.
    const response = await api.signup(data);


    // Save the JWT token returned by the backend.
    localStorage.setItem(
      "cms_token",
      response.data.token
    );


    // Save the newly created user in React state.
    setUser(response.data.user);
  }


  // ======================================================
  // LOGOUT FUNCTION
  // ======================================================

  // This function logs the user out.
  function logout() {

    // Remove the JWT token from localStorage.
    localStorage.removeItem("cms_token");

    // Remove any stale stale session metadata if the app later stores it.
    localStorage.removeItem("cms_session_user");

    // Remove the user from React state.
    //
    // null means there is no logged-in user.
    setUser(null);
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
        login,
        signup,
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
