import express from "express";
import {
  createTarget,
  getAllTargets,
  updateTarget,
  deleteTarget,
  getAllSalesPersons,
  getMyTargets,
  getTargetsByUser,
  bulkUploadTargets,
} from "../controllers/targetController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import excelUpload from "../middleware/excelUploadMiddleware.js";

const router = express.Router();

// Admin routes
router.post("/", protect, authorizeRoles("admin"), createTarget);
router.post("/bulk-upload", protect, authorizeRoles("admin"), excelUpload.single("file"), bulkUploadTargets);
router.get("/all", protect, authorizeRoles("admin"), getAllTargets);
router.get("/sales-persons", protect, authorizeRoles("admin"), getAllSalesPersons);
router.get("/user/:userId", protect, authorizeRoles("admin"), getTargetsByUser);
router.put("/:id", protect, authorizeRoles("admin"), updateTarget);
router.delete("/:id", protect, authorizeRoles("admin"), deleteTarget);

// Sales person routes
router.get("/", protect, authorizeRoles("sales_person"), getMyTargets);

export default router;
