
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String },
     email: { 
      type: String, 
      unique: true,
      sparse: true,
      validate: {
        validator: function (v) {
          if (!v) return true; 
          return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    phone: { 
      type: String, 
      required: true, 
      unique: true,
      validate: {
        validator: function (v) {
          // Accept both formats: 10 digits OR +91 followed by 10 digits
          return /^[6-9]\d{9}$/.test(v) || /^\+91[6-9]\d{9}$/.test(v);
        },
        message: "Please enter a valid 10-digit phone number (with or without +91)",
      },
    },
   pin: { 
      type: String, 
      required: function () {
        return this.isNew;
      },
      validate: {
        validator: function (v) {
          if (!v) return !this.isNew;
          // Skip validation if PIN is already hashed (60 chars)
          if (v.length === 60) return true;
          return /^\d{6}$/.test(v); 
        },
        message: "PIN must be 6 digits",
      },
    },
    role: {
      type: String,
      enum: ["admin", "sales_person"],
      default: "sales_person",
    },
    branches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        required:  function () {
          return this.role === "sales_person";
        },
      }
    ],
    employmentId: {
      type: String,
      required: function () {
        return this.role === "sales_person";
      },
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Index for faster login queries
userSchema.index({ phone: 1 });
userSchema.index({ status: 1 });
userSchema.index({ phone: 1, status: 1 });

// Normalize phone number before saving (remove +91 if present)
userSchema.pre("save", async function (next) {
  try {
    // Normalize phone number
    if (this.phone && this.phone.startsWith("+91")) {
      this.phone = this.phone.substring(3);
    }
    
    // Hash PIN only if it's modified
    if (!this.isModified("pin")) return next();
    
    // Skip hashing if PIN is already hashed (60 characters for bcrypt)
    if (this.pin && this.pin.length === 60) return next();
    
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.matchPin = async function (enteredPin) {
  return await bcrypt.compare(enteredPin, this.pin);
};

export default mongoose.model("User", userSchema);


