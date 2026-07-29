import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      default: 0
    },
    checkCode: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      enum: ["laptops", "desktops", "aios", "accessories"],
      required: [true, "Product category is required"]
    },
    model: { 
      type: String, 
      trim: true 
    },
    serialNumber: { 
      type: String, 
      trim: true 
    },
    checkNumber: { 
      type: String, 
      trim: true 
    },
    demo: { 
      type: String, 
      trim: true 
    },
    branch: { 
      type: String, 
      trim: true 
    },
    srp: { 
      type: Number, 
      min: [0, "SRP cannot be negative"] 
    },
    supportedAmount: { 
      type: Number, 
      min: [0, "Supported amount cannot be negative"] 
    },
    supportedT2DBP: { 
      type: Number, 
      min: [0, "T2DBP cannot be negative"] 
    },
    claimCode : {
      type: String, 
      trim: true
    },
    programPeriod : {
      type: String,
      trim: true
    },
    cnToPartner :{
      type : Number,
      min: [0, "CN to Partner cannot be negative"],
    },
    incentive: {
      type: Number,
      default: 0,
      min: [0, "Incentive cannot be negative"]
    },
    status: { 
      type: String, 
      enum: ["active", "inactive"], 
      default: "active" 
    },
  },
  { timestamps: true }
);

productSchema.index({ name: 1, category: 1 });
productSchema.index({ category: 1 });
productSchema.index({ model: 1 });
productSchema.index({ serialNumber: 1 });
productSchema.index({ branch: 1 });
productSchema.index({ status: 1 });

export default mongoose.model("Product", productSchema);


