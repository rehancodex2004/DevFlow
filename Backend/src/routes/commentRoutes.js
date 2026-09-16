const express=require("express");
const controller=require("../controllers/commentController");
const {requireAuth}=require("../middleware/authMiddleware");
const router=express.Router();
router.use(requireAuth);
router.get("/task/:taskId",controller.listComments);
router.post("/task/:taskId",controller.addComment);
router.delete("/:id",controller.deleteComment);
module.exports=router;
