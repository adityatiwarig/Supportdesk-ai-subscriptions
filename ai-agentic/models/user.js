import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: { type: String, required: true },
  role: { type: String, default: "user", enum: ["user", "moderator", "admin"] },
  skills: [String],
  issuesResolved: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  solvedTicketHistory: [
    {
      ticketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ticket",
        default: null,
      },
      title: { type: String, required: true },
      resolvedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date, default: null },
    },
  ],
  creditsRemaining: { type: Number, default: 5, min: 0 },
  creditsUsed: { type: Number, default: 0, min: 0 },
  subscriptionStatus: {
    type: String,
    enum: ["inactive", "active", "past_due"],
    default: "inactive",
  },
  paymentHistory: [
    {
      razorpayPaymentId: { type: String, default: "" },
      razorpayOrderId: { type: String, default: "" },
      amount: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      creditsAdded: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["created", "verified", "failed"],
        default: "created",
      },
      type: {
        type: String,
        enum: ["subscription_credit_topup"],
        default: "subscription_credit_topup",
      },
      createdAt: { type: Date, default: Date.now },
      verifiedAt: { type: Date, default: null },
    },
  ],
  razorpayPaymentId: { type: String, default: "" },
  razorpayOrderId: { type: String, default: "" },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpire: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
