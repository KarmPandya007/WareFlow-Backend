import express from "express";
import {
  getAllSalesPersons,     
  updateSalesPerson,
  deleteSalesPerson,
} from "../controllers/salesPersonController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getAllSalesPersons);
router.put("/:id", protect, authorizeRoles("admin"), updateSalesPerson);
router.delete("/:id", protect, authorizeRoles("admin"), deleteSalesPerson);

export default router;