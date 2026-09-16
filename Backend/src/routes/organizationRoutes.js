// Import Express.
// Express is used to create the router and handle API requests.
const express = require("express");


// Import all organization-related controller functions.
//
// controller contains functions such as:
// - listOrganizations
// - createOrganization
// - getOrganization
// - updateOrganization
// - deleteOrganization
// - listMembers
// - addMember
// - updateMember
// - removeMember
const controller = require("../controllers/organizationController");


// Import requireAuth middleware.
//
// requireAuth checks whether the user has a valid JWT token.
const {
  requireAuth
} = require("../middleware/authMiddleware");


// Create an Express Router.
const router = express.Router();


// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

// This middleware will run for EVERY route below.
//
// That means all organization routes require login.
//
// If the JWT token is valid:
//     requireAuth → next() → route controller runs
//
// If the JWT token is invalid/missing:
//     requireAuth → 401 response → controller does NOT run
router.use(requireAuth);


// ======================================================
// ORGANIZATION ROUTES
// ======================================================


// GET /
// Get all organizations available to the logged-in user.
//
// Example:
// GET /organizations
router.get("/", controller.listOrganizations);


// POST /
// Create a new organization.
//
// Example:
// POST /organizations
router.post("/", controller.createOrganization);


// GET /:id
// Get one organization using its ID.
//
// Example:
// GET /organizations/5
//
// Here:
// req.params.id = 5
router.get("/:id", controller.getOrganization);


// PUT /:id
// Update an existing organization.
//
// Example:
// PUT /organizations/5
//
// Here:
// req.params.id = 5
router.put("/:id", controller.updateOrganization);


// DELETE /:id
// Delete an organization using its ID.
//
// Example:
// DELETE /organizations/5
router.delete("/:id", controller.deleteOrganization);


// ======================================================
// ORGANIZATION MEMBER ROUTES
// ======================================================


// GET /:id/members
// Get all members of a specific organization.
//
// Example:
// GET /organizations/5/members
//
// 5 = organization ID
router.get("/:id/members", controller.listMembers);


// POST /:id/members
// Add a user as a member of an organization.
//
// Example:
// POST /organizations/5/members
//
// 5 = organization ID
router.post("/:id/members", controller.addMember);


// PUT /:id/members/:userId
// Update a member's information/role.
//
// Example:
// PUT /organizations/5/members/10
//
// 5  = organization ID
// 10 = user ID
router.put(
  "/:id/members/:userId",
  controller.updateMember
);


// DELETE /:id/members/:userId
// Remove a user from an organization.
//
// Example:
// DELETE /organizations/5/members/10
//
// 5  = organization ID
// 10 = user ID
router.delete(
  "/:id/members/:userId",
  controller.removeMember
);


// Export the router.
//
// server.js can import this router
// and connect it using app.use().
module.exports = router;