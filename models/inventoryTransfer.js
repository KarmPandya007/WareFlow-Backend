import mongoose from "mongoose";

const inventoryTransferSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },

  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: false,
      },
      productName: {
        type: String,
        trim: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: [0, "Quantity must be non-negative"]
      },
      batchNo: { type: String, trim: true }
    }
  ],

  sourceGodown: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Godown",
    required: false,
  },

  sourceGodownName: {
    type: String,
    trim: true,
  },

  destinationGodown: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Godown",
    required: false,
  },

  destinationGodownName: {
    type: String,
    trim: true,
  },

  
  batchNo: {
    type: String,
    trim: true,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  }
});

inventoryTransferSchema.index({ date: -1 });
inventoryTransferSchema.index({ sourceGodown: 1 });
inventoryTransferSchema.index({ destinationGodown: 1 });
inventoryTransferSchema.index({ createdBy: 1 });
inventoryTransferSchema.index({ createdAt: -1 });
inventoryTransferSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model("InventoryTransfer", inventoryTransferSchema);

