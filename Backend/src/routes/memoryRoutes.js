const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const controller = require("../controllers/memoryController");

const router = express.Router();
router.use(requireAuth);
router.get("/", controller.list);
router.get("/search", controller.search);
router.post("/", controller.create);
router.get("/:memoryId", controller.get);
router.patch("/:memoryId", controller.update);
router.delete("/:memoryId", controller.remove);
module.exports = router;
