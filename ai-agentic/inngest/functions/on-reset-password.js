import crypto from "node:crypto";
import { NonRetriableError } from "inngest";
import { inngest } from "../client.js";
import User from "../../models/user.js";
import { sendMail } from "../../utils/mailer.js";

export const onForgotPassword = inngest.createFunction(
  { id: "on-forgot-password", retries: 2 },
  { event: "user/forgot-password" },
  async ({ event, step }) => {
    try {
      const { email } = event.data;

      const user = await step.run("find-user", async () => {
        const userObject = await User.findOne({ email });
        if (!userObject) {
          throw new NonRetriableError("User does not exist");
        }
        return userObject;
      });

      const resetToken = await step.run("generate-reset-token", async () => {
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
        await user.save();

        return rawToken;
      });

      await step.run("send-reset-password-email", async () => {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

        const subject = "Reset your password";
        const message = `Hi ${user.email},

You requested a password reset.

Reset link:
${resetLink}

This link expires in 15 minutes.
If you did not request this, ignore this email.`;

        await sendMail(user.email, subject, message);
      });

      return { success: true };
    } catch (error) {
      console.error("Forgot password pipeline failed:", error.message);
      return { success: false };
    }
  }
);
