import mongoose from "mongoose";

const advanceBookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, unique: true },
    companyName: { type: String },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    salesPerson: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    date: { type: Date, default: Date.now },
    salesType: { type: String, default: "Retail" },

    customerName: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    pinCode: { type: String, length: 6 },
    contactPerson: { type: String },
    mobile: { type: String, required: true, trim: true, length: 10 },
    phone: { type: String },
    email: { type: String, trim: true, lowercase: true },
    gstNumber: { type: String, length: 15 },

    referralSource: {
      type: String,
      enum: ["Social Media Platform", "Google", "Friends/Family", "Old Customer", "Any other"],
    },
    referralSourceOther: { type: String, trim: true },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    totalAmount: { type: Number, required: true, min: 0 },
    advanceAmount: { type: Number, required: true, min: 2000 },
    remainingAmount: { type: Number },

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
    chequeNumber: { type: String },

    deliveryDate: { type: Date, required: true },
    deliveryAddress: { type: String, trim: true },

    status: {
      type: String,
      enum: ["pending", "confirmed", "delivered", "cancelled"],
      default: "pending",
    },

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

    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

advanceBookingSchema.index({ customerName: 1 });
advanceBookingSchema.index({ mobile: 1 });
advanceBookingSchema.index({ status: 1 });
advanceBookingSchema.index({ deliveryDate: 1 });
advanceBookingSchema.index({ branch: 1 });
advanceBookingSchema.index({ salesPerson: 1 });
advanceBookingSchema.index({ createdAt: -1 });

advanceBookingSchema.pre("save", async function (next) {
  if (!this.bookingId) {
    const lastBooking = await mongoose.model("AdvanceBooking")
      .findOne({ bookingId: { $exists: true } })
      .sort({ bookingId: -1 })
      .select("bookingId")
      .lean();
    
    let nextNumber = 1;
    if (lastBooking && lastBooking.bookingId) {
      const lastNumber = parseInt(lastBooking.bookingId.replace('BID', ''));
      nextNumber = lastNumber + 1;
    }
    
    this.bookingId = `BID${String(nextNumber).padStart(4, '0')}`;
  }
  
  this.remainingAmount = this.totalAmount - this.advanceAmount;
  
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


export default mongoose.model("AdvanceBooking", advanceBookingSchema);
