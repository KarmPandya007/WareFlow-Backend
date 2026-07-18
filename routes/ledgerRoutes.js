import express from "express";
import {
  createLedger,
  getAllLedgers,
  deleteAllLedgers,
  tallyLedger
} from "../controllers/ledgerController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/create",
  protect,
  authorizeRoles("admin", "sales_person"),
  createLedger
);


router.post(
  "/tally/:ledgerId",
  protect,
  authorizeRoles("admin"),
  tallyLedger
);


router.get(
  "/all",
  protect,
  authorizeRoles("admin", "sales_person"),
  getAllLedgers
);

router.delete(
  "/",
  protect,
  authorizeRoles("admin"),
  deleteAllLedgers
);

export default router;

