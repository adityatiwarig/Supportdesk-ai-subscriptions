import express from "express";
import { authenticate } from "../middlewares/auth.js";
import {
  createTicket,
  deleteTicket,
  getAssignedTickets,
  getTicket,
  getTickets,
  updateTicketStatus,
} from "../controllers/ticket.js";

const router = express.Router();

router.get("/", authenticate, getTickets);
router.get("/assigned", authenticate, getAssignedTickets);
router.get("/:id", authenticate, getTicket);
router.post("/", authenticate, createTicket);
router.patch("/:id/status", authenticate, updateTicketStatus);
router.delete("/:id", authenticate, deleteTicket);

export default router;
