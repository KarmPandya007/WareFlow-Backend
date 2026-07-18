import express from "express";
import { createGodown, getAllGodowns } from "../controllers/godownController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", protect, authorizeRoles("admin"), createGodown);
router.get("/all", getAllGodowns);

export default router;
