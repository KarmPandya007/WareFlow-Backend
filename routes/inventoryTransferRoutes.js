import express from "express";
import { createTransfer } from "../controllers/inventoryTransferController.js";
import { getAllInventoryTransfers } from "../controllers/inventoryTransferController.js";
import { deleteAllTransfers } from "../controllers/inventoryTransferController.js";
import { tallyCreateTransfer } from "../controllers/inventoryTransferController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();


router.post("/create", protect, authorizeRoles("admin", "sales_person"), createTransfer);
router.post("/create-and-tally", protect, authorizeRoles("admin", "sales_person"), tallyCreateTransfer);
router.get("/all", protect, authorizeRoles("admin", "sales_person"), getAllInventoryTransfers);

router.delete("/", protect, authorizeRoles("admin"), deleteAllTransfers);


export default router;
