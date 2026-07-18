import express from "express";
import {
  getDailyTrends,
  getDeviceBreakdown,
  getBranchSummary,
  getBranchesComparison,
  getMonthlyTrends,
  getPaymentModeBreakdown,
} from "../controllers/billingAnalyticsController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/daily", authorizeRoles("admin", "sales_person"), getDailyTrends);
router.get("/devices", authorizeRoles("admin", "sales_person"), getDeviceBreakdown);
router.get("/branch-summary", authorizeRoles("admin", "sales_person"), getBranchSummary);
router.get("/branches-comparison", authorizeRoles("admin"), getBranchesComparison);
router.get("/monthly", authorizeRoles("admin", "sales_person"), getMonthlyTrends);
router.get("/payment-modes", authorizeRoles("admin", "sales_person"), getPaymentModeBreakdown);

export default router;
