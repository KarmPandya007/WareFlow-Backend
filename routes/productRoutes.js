import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  uploadProductsExcel,
  deleteProductsByCategory,
  deleteAllProducts,
} from "../controllers/productController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();

// Excel upload - use memory storage
const memoryUpload = multer({ storage: multer.memoryStorage() });

router.post("/", protect, authorizeRoles("admin","sales_person"), createProduct);
router.post("/upload-excel", protect, authorizeRoles("admin","sales_person"), memoryUpload.single('file'), uploadProductsExcel);
router.delete("/category/:category", protect, authorizeRoles("admin"), deleteProductsByCategory);
router.put("/:id", protect, authorizeRoles("admin","sales_person"), updateProduct);
router.delete("/", protect, authorizeRoles("admin"), deleteAllProducts);
router.delete("/:id", protect, authorizeRoles("admin","sales_person"), deleteProduct);


router.get("/", protect, authorizeRoles("admin", "sales_person"), getProducts);
router.get("/:id", protect, authorizeRoles("admin", "sales_person"), getProductById);

export default router;
