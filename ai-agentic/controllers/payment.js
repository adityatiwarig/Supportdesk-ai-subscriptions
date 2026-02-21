import crypto from "node:crypto";
import Razorpay from "razorpay";
import Payment from "../models/payment.js";
import User from "../models/user.js";

const getSubscriptionAmountInr = () =>
  Number(process.env.RAZORPAY_SUBSCRIPTION_AMOUNT_INR || 499);
const getSubscriptionCredits = () => Number(process.env.SUBSCRIPTION_CREDITS || 25);
const getSubscriptionPlanId = () => process.env.SUBSCRIPTION_PLAN_ID || "starter-monthly";
const getPaymentMode = () => String(process.env.PAYMENT_MODE || "razorpay").toLowerCase();

const hasRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

  if (!keyId || !keySecret) return false;

  const invalidMarkers = ["replace_with", "your_", "xxx", "dummy"];
  const lowerId = keyId.toLowerCase();
  const lowerSecret = keySecret.toLowerCase();

  const isPlaceholder = invalidMarkers.some(
    (marker) => lowerId.includes(marker) || lowerSecret.includes(marker)
  );

  return !isPlaceholder;
};

const isMockPaymentMode = () => getPaymentMode() === "mock";

const getRazorpayClient = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

const userPaymentProjection = "email creditsRemaining creditsUsed subscriptionStatus";

export const getPaymentConfig = async (_req, res) => {
  const subscriptionAmountInr = getSubscriptionAmountInr();
  const subscriptionCredits = getSubscriptionCredits();
  const subscriptionPlanId = getSubscriptionPlanId();
  return res.status(200).json({
    mode: isMockPaymentMode() ? "mock" : "razorpay",
    keyId: process.env.RAZORPAY_KEY_ID || "",
    amountInr: subscriptionAmountInr,
    creditsToAdd: subscriptionCredits,
    planId: subscriptionPlanId,
    configured: isMockPaymentMode() ? true : hasRazorpayConfig(),
  });
};

export const getMyCredits = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(userPaymentProjection);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch credits" });
  }
};

export const createSubscriptionOrder = async (req, res) => {
  try {
    const subscriptionAmountInr = getSubscriptionAmountInr();
    const subscriptionCredits = getSubscriptionCredits();
    const subscriptionPlanId = getSubscriptionPlanId();

    const user = await User.findById(req.user._id).select(userPaymentProjection);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const amount = subscriptionAmountInr * 100;

    if (isMockPaymentMode()) {
      const orderId = `mock_order_${Date.now()}`;
      await Payment.create({
        userId: user._id,
        razorpayOrderId: orderId,
        amount,
        currency: "INR",
        status: "created",
        planId: subscriptionPlanId,
        metadata: { mode: "mock" },
      });

      return res.status(201).json({
        mode: "mock",
        orderId,
        amount,
        currency: "INR",
        keyId: "mock_key",
        user: {
          name: user.email.split("@")[0],
          email: user.email,
        },
        plan: {
          id: subscriptionPlanId,
          creditsToAdd: subscriptionCredits,
        },
      });
    }

    if (!hasRazorpayConfig()) {
      return res.status(500).json({
        message:
          "Razorpay credentials are missing/invalid. Set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend .env.",
      });
    }

    const razorpay = getRazorpayClient();
    const receipt = `sub-${user._id}-${Date.now()}`;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      notes: {
        userId: user._id.toString(),
        planId: subscriptionPlanId,
        creditsToAdd: String(subscriptionCredits),
      },
    });

    await Payment.create({
      userId: user._id,
      razorpayOrderId: order.id,
      amount,
      currency: order.currency,
      status: "created",
      planId: subscriptionPlanId,
      metadata: { receipt },
    });

    return res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      user: {
        name: user.email.split("@")[0],
        email: user.email,
      },
      plan: {
        id: subscriptionPlanId,
        creditsToAdd: subscriptionCredits,
      },
    });
  } catch (error) {
    const gatewayMessage =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      "Unable to initiate subscription checkout.";
    console.error("createSubscriptionOrder error:", gatewayMessage);
    return res.status(500).json({
      message: gatewayMessage,
      code: "CREATE_ORDER_FAILED",
    });
  }
};

export const verifySubscriptionPayment = async (req, res) => {
  try {
    const subscriptionCredits = getSubscriptionCredits();
    if (isMockPaymentMode()) {
      const mockOrderId = req.body.razorpay_order_id || req.body.orderId;

      if (!mockOrderId || !String(mockOrderId).startsWith("mock_order_")) {
        return res.status(400).json({ message: "Invalid mock order id." });
      }

      const paymentRecord = await Payment.findOne({ razorpayOrderId: mockOrderId });
      if (!paymentRecord) {
        return res.status(404).json({ message: "Mock payment order not found." });
      }
      if (String(paymentRecord.userId) !== String(req.user._id)) {
        return res.status(403).json({ message: "Payment does not belong to current user." });
      }
      if (paymentRecord.status === "verified") {
        const existingUser = await User.findById(paymentRecord.userId).select(userPaymentProjection);
        return res.status(200).json({
          message: "Payment already verified.",
          duplicate: true,
          user: existingUser,
        });
      }

      const creditsToAdd = subscriptionCredits;
      const mockPaymentId = `mock_pay_${Date.now()}`;
      const mockSignature = "mock_signature";

      const paymentUpdateResult = await Payment.updateOne(
        { _id: paymentRecord._id, status: { $ne: "verified" } },
        {
          $set: {
            status: "verified",
            razorpayPaymentId: mockPaymentId,
            razorpaySignature: mockSignature,
            creditsAdded: creditsToAdd,
            verifiedAt: new Date(),
          },
        }
      );

      if (!paymentUpdateResult.modifiedCount) {
        const latestUser = await User.findById(paymentRecord.userId).select(userPaymentProjection);
        return res.status(200).json({
          message: "Payment already verified.",
          duplicate: true,
          user: latestUser,
        });
      }

      const user = await User.findByIdAndUpdate(
        paymentRecord.userId,
        {
          $inc: { creditsRemaining: creditsToAdd },
          $set: {
            subscriptionStatus: "active",
            razorpayPaymentId: mockPaymentId,
            razorpayOrderId: mockOrderId,
          },
          $push: {
            paymentHistory: {
              razorpayPaymentId: mockPaymentId,
              razorpayOrderId: mockOrderId,
              amount: paymentRecord.amount,
              currency: paymentRecord.currency,
              creditsAdded: creditsToAdd,
              status: "verified",
              type: "subscription_credit_topup",
              verifiedAt: new Date(),
            },
          },
        },
        { new: true }
      ).select(userPaymentProjection);

      return res.status(200).json({
        message: "Mock subscription activated successfully.",
        user,
        payment: {
          razorpayPaymentId: mockPaymentId,
          razorpayOrderId: mockOrderId,
          status: "verified",
        },
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification fields." });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature." });
    }

    const paymentRecord = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!paymentRecord) {
      return res.status(404).json({ message: "Payment order not found." });
    }
    if (String(paymentRecord.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Payment does not belong to current user." });
    }

    if (paymentRecord.status === "verified") {
      const user = await User.findById(paymentRecord.userId).select(userPaymentProjection);
      return res.status(200).json({
        message: "Payment already verified.",
        duplicate: true,
        user,
      });
    }

    const creditsToAdd = subscriptionCredits;

    const paymentUpdateResult = await Payment.updateOne(
      { _id: paymentRecord._id, status: { $ne: "verified" } },
      {
        $set: {
          status: "verified",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          creditsAdded: creditsToAdd,
          verifiedAt: new Date(),
        },
      }
    );

    if (!paymentUpdateResult.modifiedCount) {
      const latestUser = await User.findById(paymentRecord.userId).select(userPaymentProjection);
      return res.status(200).json({
        message: "Payment already verified.",
        duplicate: true,
        user: latestUser,
      });
    }

    const user = await User.findByIdAndUpdate(
      paymentRecord.userId,
      {
        $inc: { creditsRemaining: creditsToAdd },
        $set: {
          subscriptionStatus: "active",
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
        },
        $push: {
          paymentHistory: {
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            amount: paymentRecord.amount,
            currency: paymentRecord.currency,
            creditsAdded: creditsToAdd,
            status: "verified",
            type: "subscription_credit_topup",
            verifiedAt: new Date(),
          },
        },
      },
      { new: true }
    ).select(userPaymentProjection);

    return res.status(200).json({
      message: "Subscription activated successfully.",
      user,
      payment: {
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        status: "verified",
      },
    });
  } catch (error) {
    console.error("verifySubscriptionPayment error:", error.message);
    return res.status(500).json({ message: "Payment verification failed." });
  }
};

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const subscriptionCredits = getSubscriptionCredits();
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return res.status(400).json({ message: "Missing webhook signature/secret." });
    }

    const rawBody = req.body;
    const generatedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (generatedSignature !== signature) {
      return res.status(400).json({ message: "Invalid webhook signature." });
    }

    const payload = JSON.parse(rawBody.toString("utf8"));
    const event = payload.event;

    if (event !== "payment.captured" && event !== "payment.failed") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const entity = payload?.payload?.payment?.entity;
    const orderId = entity?.order_id;
    const paymentId = entity?.id;

    if (!orderId) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const paymentRecord = await Payment.findOne({ razorpayOrderId: orderId });
    if (!paymentRecord) {
      return res.status(200).json({ received: true, ignored: true });
    }

    if (event === "payment.failed") {
      await Payment.updateOne(
        { _id: paymentRecord._id, status: { $ne: "verified" } },
        {
          $set: {
            status: "failed",
            razorpayPaymentId: paymentId || "",
            failureReason: entity?.error_description || "payment_failed",
          },
        }
      );

      return res.status(200).json({ received: true });
    }

    if (paymentRecord.status === "verified") {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const creditsToAdd = subscriptionCredits;

    const paymentUpdateResult = await Payment.updateOne(
      { _id: paymentRecord._id, status: { $ne: "verified" } },
      {
        $set: {
          status: "verified",
          razorpayPaymentId: paymentId || "",
          creditsAdded: creditsToAdd,
          verifiedAt: new Date(),
        },
      }
    );

    if (!paymentUpdateResult.modifiedCount) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    await User.findByIdAndUpdate(paymentRecord.userId, {
      $inc: { creditsRemaining: creditsToAdd },
      $set: {
        subscriptionStatus: "active",
        razorpayPaymentId: paymentId || "",
        razorpayOrderId: orderId,
      },
      $push: {
        paymentHistory: {
          razorpayPaymentId: paymentId || "",
          razorpayOrderId: orderId,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          creditsAdded: creditsToAdd,
          status: "verified",
          type: "subscription_credit_topup",
          verifiedAt: new Date(),
        },
      },
    });

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("handleRazorpayWebhook error:", error.message);
    return res.status(500).json({ message: "Webhook handling failed." });
  }
};

export const getMyPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user._id })
      .select("razorpayOrderId razorpayPaymentId amount currency status creditsAdded createdAt verifiedAt")
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({ payments });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch payment history." });
  }
};
