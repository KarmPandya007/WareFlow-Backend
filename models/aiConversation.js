import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 50000 },
  },
  { timestamps: true, _id: true }
);

const aiConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, trim: true, maxlength: 100, default: "New chat" },
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

aiConversationSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model("AIConversation", aiConversationSchema);
