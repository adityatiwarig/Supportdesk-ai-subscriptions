import express from "express";
import {
  forgotPassword,
  getUserDetails,
  login,
  logout,
  resetPassword,
  signup,
  updateUser,
} from "../controllers/user.js";
import { authenticate, isAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.post("/update-user", authenticate, isAdmin, updateUser);
router.get("/users", authenticate, isAdmin, getUserDetails);

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", authenticate, logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

export default router;
