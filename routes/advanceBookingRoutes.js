import express from "express";
import {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  deleteBooking,
} from "../controllers/advanceBookingController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getAllBookings);
router.get("/:id", getBookingById);
router.post("/", createBooking);
router.put("/:id", updateBooking);
router.delete("/:id", authorizeRoles("admin"), deleteBooking);

export default router;
