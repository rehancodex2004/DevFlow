const express = require("express");
const router = express.Router();

const { searchKnowledge } = require("../controllers/knowledgeController");
const { requireAuth } = require("../middleware/authMiddleware");

// Knowledge search requires a logged-in user.
// Organization membership is validated inside the controller
// (a user must belong to organizationId to search it).
router.get("/search", requireAuth, searchKnowledge);

module.exports = router;