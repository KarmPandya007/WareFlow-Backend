import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import branchRoutes from "./routes/branchRoutes.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import compression from "compression";
import billingRoutes from "./routes/billingRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import twilioRoutes from './routes/twilioRoutes.js';
import salesPersonRoutes from "./routes/salesPersonRoutes.js";
import qrUploadRoutes from "./routes/qrUploadRoutes.js";
import cron from "node-cron";
import { refreshWhatsAppToken } from "./utils/refreshWhatsAppToken.js";
import inventoryTransferRoutes from "./routes/inventoryTransferRoutes.js";
import godownRoutes from "./routes/godownRoutes.js";
import ledgerRoutes from "./routes/ledgerRoutes.js";
import gstRoutes from "./routes/gstRoutes.js";
import targetRoutes from "./routes/targetRoutes.js";
import billingAnalyticsRoutes from "./routes/billingAnalyticsRoutes.js";
import advanceBookingRoutes from "./routes/advanceBookingRoutes.js";


dotenv.config();
connectDB();

const app = express();
app.use(compression());
app.use(cookieParser());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));


app.use(express.json());


// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    success: true, 
    message: "Server is running!",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/products", productRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", qrUploadRoutes);
app.use('/api/twilio', twilioRoutes);
app.use("/api/salespersons", salesPersonRoutes);
app.use("/api/godowns", godownRoutes);
app.use("/api/ledgers", ledgerRoutes);
app.use("/api/gst", gstRoutes);
app.use("/api/targets", targetRoutes);
app.use("/api/billing-analytics", billingAnalyticsRoutes);
app.use("/api/inventory-transfers", inventoryTransferRoutes);
app.use("/api/inventory-transfer", inventoryTransferRoutes);
app.use("/api/advance-bookings", advanceBookingRoutes);

// Global error handler
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
});

cron.schedule("0 0 */30 * *", async () => {
  console.log("🔄 Cron Job: Refreshing WhatsApp access token...");
  try {
    await refreshWhatsAppToken();
  } catch (error) {
    console.error("❌ WhatsApp token refresh failed:", error.message);
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🌐 CORS enabled for: ${process.env.CLIENT_URL || "http://localhost:3000"}`);
});

