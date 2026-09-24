const express = require("express");
const controller = require("../controllers/organizationController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:token", controller.getInvitation);
router.post("/:token/accept", requireAuth, controller.acceptInvitation);
router.post("/:token/accept-and-create-account", controller.acceptInvitationAndCreateAccount);

module.exports = router;
