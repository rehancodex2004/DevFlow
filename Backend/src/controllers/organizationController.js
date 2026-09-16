// Import PostgreSQL database connection
const pool = require("../config/database");

// Import response helper functions
// ok = successful response
// created = resource created successfully
// fail = error response
const { ok, created, fail } = require("../utils/response");
const knowledgeBaseService = require("../services/knowledgeBaseService");

function reindexOrgInBackground(organizationId) {
  knowledgeBaseService
    .indexOrganization(organizationId)
    .catch((error) => console.error(`Knowledge reindex failed for organization ${organizationId}:`, error.message));
}


// ============================================================
// CHECK ORGANIZATION ADMIN
// ============================================================

// This function checks whether the logged-in user
// is an admin of the given organization.
async function assertOrgAdmin(userId, organizationId) {

  // Check the user's role in this organization
  const result = await pool.query(
    `SELECT role
     FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId]
  );

  // If user is not a member OR user is not an admin
  // then access is denied.
  if (!result.rowCount || result.rows[0].role !== "admin") {

    // Create an error
    const error = new Error(
      "Organization administrator permission required."
    );

    // HTTP 403 means user does not have permission
    error.status = 403;

    // Send error to the catch block
    throw error;
  }
}


// ============================================================
// CREATE ORGANIZATION
// ============================================================

// This function creates a new organization.
async function createOrganization(req, res) {

  // Get a database client.
  // We need this because we are using a transaction.
  const client = await pool.connect();

  try {

    // Get name and description from frontend request.
    // If description is not provided, use an empty string.
    const { name, description = "" } = req.body;

    // Check if organization name is provided.
    if (!name?.trim()) {
      return fail(res, 400, "Organization name is required.");
    }

    // Start database transaction.
    await client.query("BEGIN");

    // Insert new organization into organizations table.
    const orgResult = await client.query(
      `INSERT INTO organizations (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_by, created_at, updated_at`,
      [name.trim(), description, req.user.id]
    );

    // Get the newly created organization.
    const organization = orgResult.rows[0];

    // Add the creator to organization_members.
    // The creator automatically becomes an admin.
    await client.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [organization.id, req.user.id]
    );

    // Save all transaction changes permanently.
    await client.query("COMMIT");

    reindexOrgInBackground(organization.id);

    // Send successful response.
    return created(
      res,
      organization,
      "Organization created. You are its first admin."
    );

  } catch (error) {

    // If any error happens, undo transaction changes.
    await client.query("ROLLBACK");

    // Show actual error in terminal.
    console.error("Create organization error:", error);

    // Send error response.
    return fail(
      res,
      error.status || 500,
      error.status
        ? error.message
        : "Unable to create organization."
    );

  } finally {

    // Release database client back to the connection pool.
    client.release();
  }
}


// ============================================================
// LIST ORGANIZATIONS
// ============================================================

// This function gets all organizations
// where the logged-in user is a member.
async function listOrganizations(req, res) {

  try {

    // Get organizations from database.
    const result = await pool.query(
      `SELECT
         o.id,
         o.name,
         o.description,
         o.created_by,
         o.created_at,
         o.updated_at,
         om.role AS my_role,
         COUNT(DISTINCT all_members.id)::int AS member_count,
         COUNT(DISTINCT admins.id)::int AS admin_count
       FROM organizations o
       INNER JOIN organization_members om
         ON om.organization_id = o.id AND om.user_id = $1
       LEFT JOIN organization_members all_members
         ON all_members.organization_id = o.id
       LEFT JOIN organization_members admins
         ON admins.organization_id = o.id AND admins.role = 'admin'
       GROUP BY o.id, om.role
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    // Send organization list to frontend.
    return ok(res, result.rows);

  } catch (error) {

    // Show error in terminal.
    console.error("List organizations error:", error);

    // Send error response.
    return fail(res, 500, "Unable to load organizations.");
  }
}


// ============================================================
// GET ONE ORGANIZATION
// ============================================================

// This function gets one organization by ID.
async function getOrganization(req, res) {

  try {

    // Get organization ID from URL.
    // Example: /organizations/5
    // id = 5
    const { id } = req.params;

    // Get organization from database.
    // The query also checks that the logged-in user
    // is a member of that organization.
    const result = await pool.query(
      `SELECT o.*, om.role AS my_role
       FROM organizations o
       INNER JOIN organization_members om
         ON om.organization_id = o.id
       WHERE o.id = $1 AND om.user_id = $2`,
      [id, req.user.id]
    );

    // If organization was not found
    // or user is not a member.
    if (!result.rowCount) {
      return fail(res, 404, "Organization not found.");
    }

    // Send organization information.
    return ok(res, result.rows[0]);

  } catch (error) {

    // Show error in terminal.
    console.error("Get organization error:", error);

    // Send error response.
    return fail(res, 500, "Unable to load organization.");
  }
}


// ============================================================
// UPDATE ORGANIZATION
// ============================================================

// This function updates an organization.
async function updateOrganization(req, res) {

  try {

    // Get organization ID from URL.
    const { id } = req.params;

    // Check that current user is an organization admin.
    await assertOrgAdmin(req.user.id, id);

    // Get new name and description from frontend.
    const { name, description = "" } = req.body;

    // Organization name is required.
    if (!name?.trim()) {
      return fail(res, 400, "Organization name is required.");
    }

    // Update organization in database.
    const result = await pool.query(
      `UPDATE organizations
       SET name = $1, description = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [name.trim(), description, id]
    );

    reindexOrgInBackground(result.rows[0].id);

    // Send updated organization.
    return ok(res, result.rows[0], "Organization updated.");

  } catch (error) {

    // Show error in terminal.
    console.error("Update organization error:", error);

    // Send error response.
    return fail(
      res,
      error.status || 500,
      error.status
        ? error.message
        : "Unable to update organization."
    );
  }
}


// ============================================================
// DELETE ORGANIZATION
// ============================================================

// This function deletes an organization.
async function deleteOrganization(req, res) {

  try {

    // Get organization ID from URL.
    const { id } = req.params;

    // Only organization admin can delete it.
    await assertOrgAdmin(req.user.id, id);

    // Delete organization from database.
    await pool.query(
      "DELETE FROM organizations WHERE id = $1",
      [id]
    );

    // Send successful response.
    return ok(res, null, "Organization deleted.");

  } catch (error) {

    // Show error in terminal.
    console.error("Delete organization error:", error);

    // Send error response.
    return fail(
      res,
      error.status || 500,
      error.status
        ? error.message
        : "Unable to delete organization."
    );
  }
}


// ============================================================
// LIST MEMBERS
// ============================================================

// This function gets all members of an organization.
async function listMembers(req, res) {

  try {

    // Get organization ID from URL.
    const { id } = req.params;

    // Check whether current user is a member
    // of this organization.
    const access = await pool.query(
      `SELECT 1
       FROM organization_members
       WHERE organization_id = $1
         AND user_id = $2`,
      [id, req.user.id]
    );

    // If current user is not a member,
    // deny access.
    if (!access.rowCount) {
      return fail(
        res,
        403,
        "You are not a member of this organization."
      );
    }

    // Get all organization members.
    // User information is also fetched from users table.
    const result = await pool.query(
      `SELECT
         om.id,
         om.organization_id,
         om.user_id,
         om.role,
         om.created_at,
         u.name,
         u.email,
         u.status
       FROM organization_members om
       INNER JOIN users u
         ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY
         CASE
           WHEN om.role = 'admin' THEN 0
           ELSE 1
         END,
         u.name`,
      [id]
    );

    // Send members list to frontend.
    return ok(res, result.rows);

  } catch (error) {

    // Show error in terminal.
    console.error("List members error:", error);

    // Send error response.
    return fail(
      res,
      500,
      "Unable to load organization members."
    );
  }
}


// ============================================================
// ADD MEMBER
// ============================================================

// This function adds a user to an organization.
async function addMember(req, res) {

  try {

    // Get organization ID from URL.
    const { id } = req.params;

    // Only organization admin can add members.
    await assertOrgAdmin(req.user.id, id);

    // Invites deliberately accept an account email instead of exposing or
    // requiring opaque internal user IDs in the UI.
    const { email, role = "member" } = req.body;

    // Check that userId exists
    // and role is either admin or member.
    if (
      !email ||
      !String(email).trim() ||
      !["admin", "member"].includes(role)
    ) {
      return fail(
        res,
        400,
        "A valid email and role are required."
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Resolve the account server-side so membership is never based on a
    // frontend supplied identifier.
    const user = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    // If target user does not exist.
    if (!user.rowCount) {
      return fail(
        res,
        404,
        "No account found for that email."
      );
    }

    // Check whether user is already
    // a member of this organization.
    const existing = await pool.query(
      `SELECT id
       FROM organization_members
       WHERE organization_id = $1
         AND user_id = $2`,
      [id, user.rows[0].id]
    );

    // User is already a member.
    if (existing.rowCount) {
      return fail(
        res,
        409,
        "User is already a member."
      );
    }

    // If new member will become an admin,
    // check maximum admin limit.
    if (role === "admin") {

      // Count current admins.
      const count = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM organization_members
         WHERE organization_id = $1
           AND role = 'admin'`,
        [id]
      );

      // Maximum 3 admins are allowed.
      if (count.rows[0].count >= 3) {
        return fail(
          res,
          409,
          "Organization already has the maximum of 3 administrators."
        );
      }
    }

    // Add user to organization_members table.
    const result = await pool.query(
      `INSERT INTO organization_members
       (organization_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, user.rows[0].id, role]
    );

    // Send created member response.
    return created(
      res,
      result.rows[0],
      "Member added."
    );

  } catch (error) {

    // Show error in terminal.
    console.error("Add member error:", error);

    // Send error response.
    return fail(
      res,
      error.status || 500,
      error.status
        ? error.message
        : "Unable to add member."
    );
  }
}


// ============================================================
// UPDATE MEMBER ROLE
// ============================================================

// This function changes a member's role.
//
// member -> admin
// OR
// admin -> member
async function updateMember(req, res) {

  // Get database client for transaction.
  const client = await pool.connect();

  try {

    // Get organization ID and user ID from URL.
    const { id, userId } = req.params;

    // Only organization admin can change roles.
    await assertOrgAdmin(req.user.id, id);

    // Get new role from frontend.
    const { role } = req.body;

    // Role must be either admin or member.
    if (!["admin", "member"].includes(role)) {
      return fail(
        res,
        400,
        "Role must be admin or member."
      );
    }

    // Start transaction.
    await client.query("BEGIN");

    // Find the organization member.
    // FOR UPDATE locks the row during transaction.
    const membership = await client.query(
      `SELECT id, role
       FROM organization_members
       WHERE organization_id = $1
         AND user_id = $2
       FOR UPDATE`,
      [id, userId]
    );

    // Member does not exist.
    if (!membership.rowCount) {

      // Undo transaction.
      await client.query("ROLLBACK");

      return fail(
        res,
        404,
        "Organization member not found."
      );
    }

    // --------------------------------------------------------
    // CHANGE MEMBER TO ADMIN
    // --------------------------------------------------------

    // If current role is not admin
    // and new role is admin.
    if (
      membership.rows[0].role !== "admin" &&
      role === "admin"
    ) {

      // Count existing admins.
      const count = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM organization_members
         WHERE organization_id = $1
           AND role = 'admin'`,
        [id]
      );

      // Maximum 3 admins allowed.
      if (count.rows[0].count >= 3) {

        // Undo transaction.
        await client.query("ROLLBACK");

        return fail(
          res,
          409,
          "Organization already has the maximum of 3 administrators."
        );
      }
    }

    // --------------------------------------------------------
    // CHANGE ADMIN TO MEMBER
    // --------------------------------------------------------

    // If current role is admin
    // and new role is member.
    if (
      membership.rows[0].role === "admin" &&
      role === "member"
    ) {

      // Count current admins.
      const count = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM organization_members
         WHERE organization_id = $1
           AND role = 'admin'`,
        [id]
      );

      // Organization must always have at least
      // one administrator.
      if (count.rows[0].count <= 1) {

        // Undo transaction.
        await client.query("ROLLBACK");

        return fail(
          res,
          409,
          "An organization must keep at least one administrator."
        );
      }
    }

    // Update member role.
    const result = await client.query(
      `UPDATE organization_members
       SET role = $1, updated_at = NOW()
       WHERE organization_id = $2 AND user_id = $3
       RETURNING *`,
      [role, id, userId]
    );

    // Save transaction changes.
    await client.query("COMMIT");

    // Send updated member.
    return ok(
      res,
      result.rows[0],
      "Member role updated."
    );

  } catch (error) {

    // Undo transaction if an error happens.
    await client.query("ROLLBACK");

    // Show error in terminal.
    console.error("Update member error:", error);

    // Send error response.
    return fail(
      res,
      error.status || 500,
      error.status
        ? error.message
        : "Unable to update member."
    );

  } finally {

    // Release database client.
    client.release();
  }
}


// ============================================================
// REMOVE MEMBER
// ============================================================

// This function removes a member from an organization.
async function removeMember(req, res) {

  try {

    // Get organization ID and target user ID from URL.
    const { id, userId } = req.params;

    // Only organization admin can remove members.
    await assertOrgAdmin(req.user.id, id);

    // Admin cannot remove himself.
    if (Number(userId) === req.user.id) {
      return fail(
        res,
        400,
        "You cannot remove yourself. Transfer admin responsibility first."
      );
    }

    // Check whether target user is a member.
    const member = await pool.query(
      `SELECT role FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [id, userId]
    );

    // Member does not exist.
    if (!member.rowCount) {
      return fail(
        res,
        404,
        "Organization member not found."
      );
    }

    // If target member is an admin,
    // check whether another admin exists.
    if (member.rows[0].role === "admin") {

      // Count admins.
      const count = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM organization_members
         WHERE organization_id = $1 AND role = 'admin'`,
        [id]
      );

      // Last administrator cannot be removed.
      if (count.rows[0].count <= 1) {
        return fail(
          res,
          409,
          "The last administrator cannot be removed."
        );
      }
    }

    // Remove member from organization.
    await pool.query(
      `DELETE FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [id, userId]
    );

    // Send successful response.
    return ok(
      res,
      null,
      "Member removed."
    );

  } catch (error) {

    // Show error in terminal.
    console.error("Remove member error:", error);

    // Send error response.
    return fail(
      res,
      error.status || 500,
      error.status
        ? error.message
        : "Unable to remove member."
    );
  }
}


// ============================================================
// EXPORT
// ============================================================

// Export all controller functions.
// Routes file can import and use these functions.
module.exports = {
  createOrganization,
  listOrganizations,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  listMembers,
  addMember,
  updateMember,
  removeMember
};
