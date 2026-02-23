import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { serve } from "inngest/express";
import userRoutes from "./routes/user.js";
import ticketRoutes from "./routes/ticket.js";
import paymentRoutes from "./routes/payment.js";
import { inngest } from "./inngest/client.js";
import { onUserSignup } from "./inngest/functions/on-signup.js";
import { onTicketCreated } from "./inngest/functions/on-ticket-create.js";
import { onForgotPassword } from "./inngest/functions/on-reset-password.js";
import { handleRazorpayWebhook } from "./controllers/payment.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGINS = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || CLIENT_ORIGINS.length === 0 || CLIENT_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  })
);

app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handleRazorpayWebhook
);

app.use(express.json());

app.get("/api/health", (_, res) => {
  res.status(200).json({ ok: true });
});

app.use("/api/auth", userRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/payments", paymentRoutes);

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [onUserSignup, onTicketCreated, onForgotPassword],
  })
);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
