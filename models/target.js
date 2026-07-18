import mongoose from "mongoose";

const targetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["sales", "billing_count", "billing_amount", "product_based"],
      required: true,
    },
    targetValue: {
      type: Number,
      min: 0,
    },
    currentValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    productTargets: [
      {
        category: {
          type: String,
          enum: ["laptops", "desktops", "aios", "accessories"],
          required: true,
        },
        targetValue: {
          type: Number,
          required: true,
          min: 0,
        },
        currentValue: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
    incentiveAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    incentiveStatus: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },
    incentivePaidDate: {
      type: Date,
    },
    period: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "overdue"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Index for faster queries
targetSchema.index({ user: 1, status: 1 });
targetSchema.index({ endDate: 1 });

export default mongoose.model("Target", targetSchema);
