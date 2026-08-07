import express from "express";
import rateLimit from "express-rate-limit";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  chat,
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from "../controllers/aiController.js";

const router = express.Router();

// Rate-limit: max 30 requests per minute per IP to protect Gemini API quota
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests to the AI assistant. Please wait a moment and try again.",
  },
});

router.use(protect, authorizeRoles("admin"));
router.get("/conversations", listConversations);
router.get("/conversations/:id", getConversation);
router.patch("/conversations/:id", renameConversation);
router.delete("/conversations/:id", deleteConversation);
router.post("/chat", aiRateLimiter, chat);

export default router;
