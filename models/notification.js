import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["whatsapp", "email"], required: true },
    recipient: { type: String, required: true },
    billing: { type: mongoose.Schema.Types.ObjectId, ref: "Billing" },
    status: { type: String, enum: ["sent","failed"], default: "sent" },
    message: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
