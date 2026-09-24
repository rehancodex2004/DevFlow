// Import Express.
// Express is used to create the router and handle API routes.
const express = require("express");


// Import authentication controller functions.
//
// signup → creates a new user
// login  → logs an existing user in
// me     → gets information about the currently logged-in user
const {
  signup,
  login,
  me,
  updateMe,
  logout,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/authController");


// Import requireAuth middleware.
//
// requireAuth checks whether the user has a valid JWT token.
const {
  requireAuth
} = require("../middleware/authMiddleware");


// Create a new Express Router.
//
// router will be used to define authentication-related routes.
const router = express.Router();


// ======================================================
// SIGNUP ROUTE
// ======================================================

// POST /signup
//
// User sends name, email, password, etc.
// signup controller creates the new user.
//
// Example:
// POST /auth/signup
router.post("/signup", signup);


// ======================================================
// LOGIN ROUTE
// ======================================================

// POST /login
//
// User sends email and password.
// login controller checks the credentials
// and creates/sends a JWT token.
//
// Example:
// POST /auth/login
router.post("/login", login);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);


// ======================================================
// CURRENT USER ROUTE
// ======================================================

// GET /me
//
// requireAuth runs FIRST.
//
// It checks the JWT token.
// If the token is valid → next() → me controller runs.
//
// If the token is missing/invalid → request stops with 401.
//
// Example:
// GET /auth/me
router.get("/me", requireAuth, me);

// PUT /auth/me updates only the authenticated user's own profile.
router.put("/me", requireAuth, updateMe);

// POST /auth/logout revokes the presented JWT on the backend.
router.post("/logout", requireAuth, logout);


// Export this router.
//
// server.js can now import this router
// and connect it using app.use().
module.exports = router;
