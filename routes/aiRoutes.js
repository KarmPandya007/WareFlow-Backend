import express from "express";
import rateLimit from "express-rate-limit";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { chat } from "../controllers/aiController.js";

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

// POST /api/ai/chat — Admin only
router.post("/chat", aiRateLimiter, protect, authorizeRoles("admin"), chat);

export default router;
