import mongoose from "mongoose";

const billingSchema = new mongoose.Schema(
  {
    companyName: { type: String },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    salesPerson: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    salesType: { type: String, default: "Retail" },


    customerName: { type: String, required: true },
    address: { type: String },
    pinCode: { type: String, length: 6 },
    contactPerson: { type: String },
    mobile: { type: String, length: 10 },
    phone: { type: String },
    email: { type: String },
    gstNumber: { type: String, length: 15 },

    referralSource: {
      type: String,
      enum: ["Social Media Platform", "Google", "Friends/Family", "Old Customer", "Any other"],
    },
    referralSourceOther: { type: String },

    paymentMode: [
      {
        mode: {
          type: String,
          enum: ["Cash", "Bank", "UPI", "Machine", "Bajaj Finance", "Brand Order"],
          required: true,
        },
        amount: { type: Number },

        // Bank sub-fields
        bankType: {
          type: String,
          enum: ["NEFT", "RTGS", "IMPS", "Net Banking", "Cheque"],
        },
        utrNumber: { type: String },
        chequeNumber: { type: String },

        // UPI sub-fields
        upiProvider: {
          type: String,
          enum: ["PhonePe"],
        },
        upiTransactionId: { type: String },

        // Machine sub-fields
        machineProvider: {
          type: String,
          enum: ["Pinelabs", "Paytm"],
        },
        machineCardType: {
          type: String,
          enum: ["Credit Card", "Debit Card"],
        },
        machineCardLast4Digits: { type: String, length: 4 },
        machineIdProofType: {
          type: String,
          enum: ["Aadhaar", "PAN"],
        },
        machineIdProofNumber: { type: String },
        machineTransactionId: { type: String },

        // Bajaj Finance sub-fields
        loanAmount: { type: Number },
        loanId: { type: String },

        // Credit Card / Debit Card / Bajaj Finance sub-fields
        cardLast4Digits: { type: String, length: 4 },
        idProofType: {
          type: String,
          enum: ["Aadhaar", "PAN"],
        },
        idProofNumber: { type: String },

        // Brand Order sub-fields
        brandOrderType: {
          type: String,
          enum: ["Lenovo OMO", "Asus Eshop"],
        },
      }
    ],
    chequeNumber: { type: String }, // Deprecated - kept for backward compatibility
    totalAmount: { type: Number, required: true },


    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      }
    ],


    attachments: {
      customerID: { type: String },
      paymentSlip: { type: String },
      inventoryPics: [{ type: String }],
      googleReview: { type: String },
    },
    customFields: [
      {
        key: { type: String },
        value: { type: String },
      },
    ],
  },
  { timestamps: true }
);

billingSchema.pre("save", function (next) {
  // Validate ID proof numbers
  if (this.paymentMode && Array.isArray(this.paymentMode)) {
    for (const pm of this.paymentMode) {
      if (pm.machineIdProofType && pm.machineIdProofNumber) {
        if (pm.machineIdProofType === 'Aadhaar' && !/^\d{12}$/.test(pm.machineIdProofNumber)) {
          return next(new Error('Aadhaar number must be exactly 12 digits'));
        }
        if (pm.machineIdProofType === 'PAN' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pm.machineIdProofNumber)) {
          return next(new Error('PAN number must be 10 characters in format: ABCDE1234F'));
        }
      }
      if (pm.idProofType && pm.idProofNumber) {
        if (pm.idProofType === 'Aadhaar' && !/^\d{12}$/.test(pm.idProofNumber)) {
          return next(new Error('Aadhaar number must be exactly 12 digits'));
        }
        if (pm.idProofType === 'PAN' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pm.idProofNumber)) {
          return next(new Error('PAN number must be 10 characters in format: ABCDE1234F'));
        }
      }
    }
  }
  next();
});

// Indexing branch, salesPerson and dates for faster lookups
billingSchema.index({ branch: 1 });
billingSchema.index({ salesPerson: 1 });
billingSchema.index({ date: -1 });
billingSchema.index({ createdAt: -1 });
billingSchema.index({ salesPerson: 1, createdAt: -1 });

export default mongoose.model("Billing", billingSchema);
