import express from "express";
import { verifyGST } from "../controllers/gstController.js";

const router = express.Router();

router.get("/verify/:gstin", verifyGST);

export default router;
