import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true 
    },

    phone: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    gstNo: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },

    panCard: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },

    // Tally-required grouping
    ledgerGroup: {
      type: String,
      default: "Sundry Debtors"
    },

    // GST registration type (explicit for XML, not inferred)
    gstRegistrationType: {
      type: String,
      enum: ["Regular", "Composition", "Unregistered"],
      default: "Unregistered"
    },

    address: {
      type: String,
      required: true,
      trim: true
    },

    pincode: {
      type: String,
      required: true,
      trim: true
    },

    state: {
      type: String,
      required: true,
      trim: true
    },

    country: {
      type: String,
      required: true,
      trim: true,
      default: "India"
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Ledger", ledgerSchema);

