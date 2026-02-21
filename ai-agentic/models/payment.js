import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String, default: "", unique: true, sparse: true },
  razorpaySignature: { type: String, default: "" },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  status: {
    type: String,
    enum: ["created", "verified", "failed"],
    default: "created",
  },
  creditsAdded: { type: Number, default: 0, min: 0 },
  planId: { type: String, default: "starter-monthly" },
  verifiedAt: { type: Date, default: null },
  failureReason: { type: String, default: "" },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Payment", paymentSchema);
