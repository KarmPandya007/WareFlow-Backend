import mongoose from "mongoose";


const qrUploadSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    filename: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fieldType: { type: String }, // e.g., "Customer ID", "Payment Slip"
    size: { type: Number },
    mimetype: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    processed: { type: Boolean, default: false } // Flag to track if included in billing
  },
  { timestamps: true }
);

const QRUpload = mongoose.model("QRUpload", qrUploadSchema);

export default QRUpload;
