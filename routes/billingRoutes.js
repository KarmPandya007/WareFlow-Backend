import express from "express";
import {
  createBilling,
  getAllBillings,
  getBillingById,
  updateBilling,
  deleteBilling,
  exportBillings,
  tallyBilling,
} from "../controllers/billingController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post(
  "/",
  protect,
  authorizeRoles("admin", "sales_person"),
  upload.fields([
    { name: "customerID", maxCount: 1 },
    { name: "paymentSlip", maxCount: 1 },
    { name: "inventoryPics", maxCount: 3 },
    { name: "googleReview", maxCount: 1 },
  ]),
  createBilling
);

router.get("/export", exportBillings);
router.get("/", protect, authorizeRoles("admin", "sales_person"), getAllBillings);
// Create billing and return Tally-ready JSON (no file upload expected)
router.post("/create-and-tally", protect, authorizeRoles("admin", "sales_person"), tallyBilling);
router.get("/:id", protect, authorizeRoles("admin", "sales_person"), getBillingById);
router.put("/:id", protect, authorizeRoles("admin", "sales_person"), updateBilling);
router.delete("/:id", protect, authorizeRoles("admin"), deleteBilling);

// Route to download billing data as XML
// Billing XML/Tally routes removed (XML integration removed)

export default router;
