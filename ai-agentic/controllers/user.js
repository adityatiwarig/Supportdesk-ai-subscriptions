import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import User from "../models/user.js";
import { inngest } from "../inngest/client.js";
import { sendMail } from "../utils/mailer.js";

const sanitizeUser = (user) => ({
  _id: user._id,
  email: user.email,
  role: user.role,
  skills: user.skills,
  issuesResolved: user.issuesResolved,
  score: user.score,
  creditsRemaining: user.creditsRemaining,
  creditsUsed: user.creditsUsed,
  subscriptionStatus: user.subscriptionStatus,
  razorpayPaymentId: user.razorpayPaymentId,
  razorpayOrderId: user.razorpayOrderId,
  createdAt: user.createdAt,
});

export const signup = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const { skills = [] } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      skills,
    });

    try {
      await inngest.send({
        name: "user/signup",
        data: { email },
      });
    } catch (err) {
      console.error("Inngest failed:", err.message);
    }

    const token = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_TOKEN);

    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (error) {
    return res.status(500).json({
      error: "signup failed",
      details: error.message,
    });
  }
};

export const login = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_TOKEN);

    return res.json({ user: sanitizeUser(user), token });
  } catch (error) {
    return res.status(500).json({
      error: "Login failed",
      details: error.message,
    });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    jwt.verify(token, process.env.JWT_TOKEN);
    return res.json({ message: "Logout successful." });
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

export const updateUser = async (req, res) => {
  const { skills = [], role, email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const nextRole = role || user.role;
    const nextSkills = skills.length ? skills : user.skills;

    await User.updateOne({ email }, { role: nextRole, skills: nextSkills });

    return res.json({ message: "User updated successfully." });
  } catch (error) {
    return res.status(500).json({
      error: "Update failed.",
      details: error.message,
    });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    return res.json(users);
  } catch (error) {
    return res.status(500).json({
      error: "Get Users req failed",
      details: error.message,
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    let devResetLink = "";
    let mailDelivery = "skipped";

    const user = await User.findOne({ email });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
      await user.save();

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const resetLink = `${frontendUrl}/reset-password/${rawToken}`;
      devResetLink = resetLink;

      try {
        await sendMail(
          user.email,
          "Reset your password",
          `Hi ${user.email},

You requested a password reset.

Reset link:
${resetLink}

This link expires in 15 minutes.
If you did not request this, ignore this email.`
        );
        mailDelivery = "email_sent";
      } catch (mailError) {
        mailDelivery = "email_failed";
        console.error("SMTP send failed:", mailError.message);
        console.log("DEV reset link fallback:", resetLink);
      }
    }

    const exposeResetLink =
      process.env.NODE_ENV !== "production" &&
      (process.env.DEV_EXPOSE_RESET_LINK || "true") === "true";

    return res.status(200).json({
      message:
        "If your account exists, a password reset link has been sent to your email.",
      mailDelivery,
      resetLink: exposeResetLink ? devResetLink : "",
    });
  } catch (error) {
    console.error("Forgot password request failed:", error.message);
    return res.status(500).json({
      error: "Forgot password request failed",
      details: error.message,
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const token = String(req.params.token || "");
    const password = String(req.body.password || "");

    if (!token || !password || password.length < 6) {
      return res.status(400).json({
        error: "Token and a password of at least 6 characters are required.",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid or expired reset token.",
      });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successful." });
  } catch (error) {
    return res.status(500).json({
      error: "Reset password failed",
      details: error.message,
    });
  }
};
