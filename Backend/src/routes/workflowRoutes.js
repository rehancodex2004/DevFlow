const express = require("express");
const controller = require("../controllers/workflowController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

router.get("/statuses", controller.listStatuses);
router.post("/statuses", controller.createStatus);
router.put("/statuses/reorder", controller.reorderStatuses);
router.put("/statuses/:statusId", controller.updateStatus);
router.delete("/statuses/:statusId", controller.deleteStatus);

router.get("/role-tags", controller.listRoleTags);
router.post("/role-tags", controller.createRoleTag);
router.put("/role-tags/:roleTagId", controller.updateRoleTag);
router.delete("/role-tags/:roleTagId", controller.deleteRoleTag);

module.exports = router;
