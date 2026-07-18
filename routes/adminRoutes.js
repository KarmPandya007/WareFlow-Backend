import express from "express";
import {
  getDashboardTotals,
  getBranchPerformance,
  getSalesPersonPerformance,
  getRecentActivities,
  getFilteredBillings,
  getProductWiseReport,
  getPaymentModeAnalysis,
  getCustomReport,
} from "../controllers/adminController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";


const router = express.Router();


router.use(protect);
router.use(authorizeRoles("admin"));


router.get("/dashboard/totals", getDashboardTotals);


router.get("/dashboard/branches", getBranchPerformance);


router.get("/dashboard/salespersons", getSalesPersonPerformance);


router.get("/dashboard/recent-activities", getRecentActivities);

router.get("/billings", getFilteredBillings);
router.get("/reports/products", getProductWiseReport);


router.get("/reports/payment-modes", getPaymentModeAnalysis);
router.get("/reports/custom", getCustomReport);

export default router;


