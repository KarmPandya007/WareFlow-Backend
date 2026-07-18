import express from "express";
import { login, registerUser,logout } from "../controllers/authController.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

console.log("Auth routes loaded!");

const router = express.Router();

router.post("/login", login);
router.post("/register", protect, authorizeRoles("admin"), registerUser);
router.post("/logout", logout);


export default router;
