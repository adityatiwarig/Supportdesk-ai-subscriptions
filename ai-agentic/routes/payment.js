import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  createSubscriptionOrder,
  getMyCredits,
  getMyPaymentHistory,
  getPaymentConfig,
  verifySubscriptionPayment,
} from "../controllers/payment.js";

const router = express.Router();

router.get("/config", authenticate, getPaymentConfig);
router.get("/credits", authenticate, getMyCredits);
router.get("/history", authenticate, getMyPaymentHistory);
router.post("/create-order", authenticate, createSubscriptionOrder);
router.post("/verify", authenticate, verifySubscriptionPayment);

export default router;
