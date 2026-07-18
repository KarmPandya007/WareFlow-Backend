import mongoose from "mongoose";

const salesPersonSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^\+91\d{10}$/, "Phone number must start with +91 and be 10 digits"],
    },
    branches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
      }
    ],
    empId: {
      type: String,
      required: [true, "Employee ID is required"],
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

const SalesPerson = mongoose.model("SalesPerson", salesPersonSchema);

export default SalesPerson;