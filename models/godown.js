import mongoose from "mongoose";

const godownSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },

  address: {
    type: String,
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Godown", godownSchema);

