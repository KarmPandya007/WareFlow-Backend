import express from "express";
import { uploadViaQR, getSessionUploads, deleteQRUpload } from "../controllers/qrUploadController.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Upload file via QR code (no auth required for mobile upload)
router.post("/qr/:sessionId", upload.single("file"), uploadViaQR);

// Get all uploads for a session
router.get("/qr/:sessionId", getSessionUploads);

// Delete a specific QR upload
router.delete("/qr/:uploadId", deleteQRUpload);

export default router;