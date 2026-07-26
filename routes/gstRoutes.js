import express from "express";
import { verifyGST } from "../controllers/gstController.js";
import { protect } from "../middleware/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const gstLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 verification requests per window
  message: {
    success: false,
    message: "Too many GST verification requests from this IP, please try again after 15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/verify/:gstin", protect, gstLimiter, verifyGST);

export default router;
