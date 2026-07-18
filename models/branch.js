// import mongoose from "mongoose";

// const branchSchema = new mongoose.Schema({
//   name: { type: String, required: true },              
//   code: { type: String, required: true, unique: true }, 
//   location: { type: String },                          
//   contact: { type: String },                          
//   status: { type: String, enum: ["active", "inactive"], default: "active" }, 
// }, { timestamps: true });                              

// export default mongoose.model("Branch", branchSchema);

import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true
    },

    code: {
      type: String,
      unique: true,
      trim: true
    },

    location: {
      type: String,
      trim: true
    },

    contact: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true; // contact is optional
          return /^[6-9]\d{9}$/.test(v); // 10-digit Indian number
        },
        message: "Please enter a valid 10-digit phone number",
      },
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      lowercase: true,
      default: "active"
    }

  },
  { timestamps: true }
);

// Auto-generate branch code if not provided
branchSchema.pre("save", async function (next) {
  if (!this.code) {
    this.code = "BR" + Date.now();
  }
  next();
});

export default mongoose.model("Branch", branchSchema);
