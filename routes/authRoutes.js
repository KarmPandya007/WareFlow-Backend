import express from "express";
import { login, registerUser,logout } from "../controllers/authController.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import rateLimit from "express-rate-limit";

console.log("Auth routes loaded!");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per window
  message: {
    success: false,
    message: "Too many login attempts from this IP, please try again after 15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});
router.post("/login", loginLimiter, login);
router.post("/register", protect, authorizeRoles("admin"), registerUser);
router.post("/logout", logout);


export default router;
