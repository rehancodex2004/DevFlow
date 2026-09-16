const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const {
  taskChat,
  getTaskChatHistory,
  globalChat,
  getGlobalChatHistory,
  getChatSessionHistory,
  endTaskChat,
  endGlobalChat,
  getRecentChats,
} = require("../controllers/aiController");

const { requireAuth } = require("../middleware/authMiddleware");

const { runTaskAgent } = require("../services/agentService");

const { assertTaskAccess } = require("../services/retrievalService");

// =====================================================
// TASK AI
// =====================================================

// Task Chat
router.post("/task/:taskId/chat", requireAuth, taskChat);

// Task Chat History
router.get("/task/:taskId/chat/history", requireAuth, getTaskChatHistory);

// End Task Chat
router.post("/task/:taskId/chat/end", requireAuth, endTaskChat);

// =====================================================
// TASK AI AGENT
// =====================================================

router.post(
  "/task/:taskId/agent",
  requireAuth,
  async (req, res) => {
    try {
      const taskId = Number(req.params.taskId);

      const {
        message,
        confirmationToken = null
      } = req.body;

      if (!Number.isInteger(taskId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task ID."
        });
      }

      if (!message || !message.trim()) {
        return res.status(400).json({
          success: false,
          message: "Message is required."
        });
      }

      const scope = await assertTaskAccess(
        req.user.id,
        taskId
      );

      let confirmed = false;
      if (confirmationToken) {
        // A client boolean is not sufficient for deletion. The short-lived token
        // is only minted after this same authorized agent asks for confirmation.
        const confirmation = jwt.verify(confirmationToken, process.env.JWT_SECRET);
        confirmed = confirmation.type === "task-agent-confirmation"
          && confirmation.action === "delete_task"
          && Number(confirmation.userId) === Number(req.user.id)
          && Number(confirmation.taskId) === Number(scope.taskId);
      }

      const result = await runTaskAgent({
        taskId: scope.taskId,
        projectId: scope.projectId,
        organizationId: scope.organizationId,
        userId: req.user.id,
        message: message.trim(),
        confirmed
      });

      if (result.requiresConfirmation && result.confirmationAction === "delete_task") {
        result.confirmationToken = jwt.sign(
          {
            type: "task-agent-confirmation",
            action: "delete_task",
            userId: req.user.id,
            taskId: scope.taskId,
          },
          process.env.JWT_SECRET,
          { expiresIn: "5m" },
        );
      }

      return res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error(
        "TASK AGENT ERROR:",
        error
      );

      return res.status(
        error.status || 500
      ).json({
        success: false,
        message:
          error.message ||
          "AI Agent failed."
      });
    }
  }
);

// =====================================================
// GLOBAL AI
// =====================================================

// Global Chat
router.post("/global/chat", requireAuth, globalChat);

// Global Chat History
router.get("/global/chat/history", requireAuth, getGlobalChatHistory);

// End Global Chat
router.post("/global/chat/end", requireAuth, endGlobalChat);

// =====================================================
// SAVED CHAT HISTORY
// =====================================================

router.get("/chats/:sessionId/history", requireAuth, getChatSessionHistory);

// =====================================================
// RECENT CHATS
// =====================================================

router.get("/chats/recent", requireAuth, getRecentChats);

module.exports = router;
