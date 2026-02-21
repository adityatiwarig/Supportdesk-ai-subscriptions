import { inngest } from "../inngest/client.js";
import Ticket from "../models/ticket.js";
import User from "../models/user.js";
import { processTicketAgent } from "../services/ticket-agent.js";

const MODERATOR_STATUSES = new Set(["PENDING", "RESOLVED"]);
const RESOLUTION_POINTS = 10;

const isAssignedModerator = (user, ticket) =>
  user.role === "moderator" && String(ticket.assignedTo || "") === String(user._id);

export const createTicket = async (req, res) => {
  let creditConsumed = false;
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required." });
    }

    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const requester = await User.findById(req.user._id).select(
      "role creditsRemaining creditsUsed subscriptionStatus"
    );
    if (!requester) {
      return res.status(404).json({ message: "User not found." });
    }

    let updatedCredits = null;
    if (requester.role === "user") {
      updatedCredits = await User.findOneAndUpdate(
        { _id: req.user._id, creditsRemaining: { $gt: 0 } },
        { $inc: { creditsRemaining: -1, creditsUsed: 1 } },
        { new: true }
      ).select("creditsRemaining creditsUsed subscriptionStatus");

      if (!updatedCredits) {
        return res.status(402).json({
          code: "CREDIT_EXHAUSTED",
          message: "No credits remaining. Please subscribe to continue creating tickets.",
        });
      }
      creditConsumed = true;
    }

    const newTicket = await Ticket.create({
      title,
      description,
      createdBy: req.user._id.toString(),
    });

    let queuedToInngest = true;

    try {
      await inngest.send({
        name: "ticket/created",
        data: {
          ticketId: newTicket._id.toString(),
          title,
          description,
          createdBy: req.user._id.toString(),
        },
      });
    } catch (error) {
      queuedToInngest = false;
      console.error("Inngest send failed, running local fallback:", error.message);
      await processTicketAgent({ ticketId: newTicket._id, sendNotification: true });
    }

    const latestTicket = await Ticket.findById(newTicket._id)
      .populate("assignedTo", ["email", "_id"])
      .populate("resolvedBy", ["email", "_id"]);

    return res.status(201).json({
      message: queuedToInngest
        ? "Ticket created successfully. AI agent is processing it."
        : "Ticket created and processed by local AI fallback.",
      ticket: latestTicket,
      credits: updatedCredits
        ? {
            creditsRemaining: updatedCredits.creditsRemaining,
            creditsUsed: updatedCredits.creditsUsed,
            subscriptionStatus: updatedCredits.subscriptionStatus,
          }
        : null,
    });
  } catch (error) {
    if (creditConsumed) {
      await User.updateOne(
        { _id: req.user?._id },
        { $inc: { creditsRemaining: 1, creditsUsed: -1 } }
      );
    }
    console.error("Error creating ticket:", error.message);
    return res.status(500).json({ message: error.message });
  }
};

export const getTickets = async (req, res) => {
  try {
    const user = req.user;
    let tickets = [];

    if (user.role !== "user") {
      tickets = await Ticket.find({})
        .populate("assignedTo", ["email", "_id", "issuesResolved", "score"])
        .populate("resolvedBy", ["email", "_id", "issuesResolved", "score"])
        .sort({ createdAt: -1 });
    } else {
      tickets = await Ticket.find({ createdBy: user._id })
        .select("title description summary status createdAt resolvedAt")
        .sort({ createdAt: -1 });
    }

    return res.status(200).json(tickets);
  } catch (error) {
    console.error("Error fetching tickets", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getAssignedTickets = async (req, res) => {
  try {
    if (req.user.role !== "moderator") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const tickets = await Ticket.find({
      assignedTo: req.user._id,
      status: { $ne: "RESOLVED" },
    })
      .populate("assignedTo", ["email", "_id", "issuesResolved", "score"])
      .populate("resolvedBy", ["email", "_id", "issuesResolved", "score"])
      .sort({ createdAt: -1 });

    const moderator = await User.findById(req.user._id).select(
      "email role issuesResolved score solvedTicketHistory"
    );

    let solvedHistory = Array.isArray(moderator?.solvedTicketHistory)
      ? [...moderator.solvedTicketHistory]
      : [];

    // Backfill history for old records that were resolved before history persistence existed.
    if (solvedHistory.length === 0) {
      const fallbackHistory = await Ticket.find({
        resolvedBy: req.user._id,
        status: "RESOLVED",
      })
        .select("_id title resolvedAt createdAt")
        .sort({ resolvedAt: -1, createdAt: -1 })
        .limit(100);

      solvedHistory = fallbackHistory.map((item) => ({
        ticketId: item._id,
        title: item.title,
        resolvedAt: item.resolvedAt || item.createdAt,
        deletedAt: null,
      }));
    }

    solvedHistory = solvedHistory
      .map((item) => ({
        ticketId: item.ticketId || null,
        title: item.title,
        resolvedAt: item.resolvedAt,
        deletedAt: item.deletedAt || null,
      }))
      .sort(
        (a, b) =>
          Number(new Date(b.resolvedAt || 0)) - Number(new Date(a.resolvedAt || 0))
      )
      .slice(0, 100);

    const moderatorStats = moderator
      ? {
          email: moderator.email,
          role: moderator.role,
          issuesResolved: moderator.issuesResolved,
          score: moderator.score,
        }
      : null;

    return res.status(200).json({ tickets, solvedHistory, moderatorStats });
  } catch (error) {
    console.error("Error fetching assigned tickets", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    if (!req.user || req.user.role === "user") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const status = String(req.body.status || "").toUpperCase();

    if (!MODERATOR_STATUSES.has(status)) {
      return res
        .status(400)
        .json({ message: "Invalid status. Use PENDING or RESOLVED." });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (
      req.user.role === "moderator" &&
      !isAssignedModerator(req.user, ticket)
    ) {
      return res
        .status(403)
        .json({ message: "You can only update your assigned tickets." });
    }

    const previousStatus = String(ticket.status || "").toUpperCase();

    if (previousStatus === "RESOLVED" && status !== "RESOLVED" && ticket.resolvedBy) {
      await User.findByIdAndUpdate(ticket.resolvedBy, {
        $inc: { issuesResolved: -1, score: -RESOLUTION_POINTS },
      });
      ticket.resolvedAt = null;
      ticket.resolvedBy = null;
    }

    if (previousStatus !== "RESOLVED" && status === "RESOLVED") {
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = req.user._id;

      if (req.user.role === "moderator") {
        await User.findByIdAndUpdate(req.user._id, {
          $pull: { solvedTicketHistory: { ticketId: ticket._id } },
        });
        await User.findByIdAndUpdate(req.user._id, {
          $inc: { issuesResolved: 1, score: RESOLUTION_POINTS },
          $push: {
            solvedTicketHistory: {
              ticketId: ticket._id,
              title: ticket.title,
              resolvedAt: ticket.resolvedAt,
              deletedAt: null,
            },
          },
        });
      }
    }

    ticket.status = status;
    await ticket.save();

    const updatedTicket = await Ticket.findById(ticket._id)
      .populate("assignedTo", ["email", "_id", "issuesResolved", "score"])
      .populate("resolvedBy", ["email", "_id", "issuesResolved", "score"]);

    const moderatorStats = await User.findById(req.user._id).select(
      "email role issuesResolved score"
    );

    return res.status(200).json({
      message: "Ticket status updated successfully.",
      ticket: updatedTicket,
      moderatorStats,
    });
  } catch (error) {
    console.error("Error updating ticket status", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const deleteTicket = async (req, res) => {
  try {
    if (!req.user || (req.user.role !== "moderator" && req.user.role !== "admin")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (req.user.role === "moderator" && !isAssignedModerator(req.user, ticket)) {
      return res.status(403).json({ message: "You can only delete your assigned tickets." });
    }

    if (ticket.resolvedBy) {
      await User.findOneAndUpdate(
        { _id: ticket.resolvedBy, "solvedTicketHistory.ticketId": ticket._id },
        {
          $set: {
            "solvedTicketHistory.$.deletedAt": new Date(),
          },
        }
      );
    }

    await ticket.deleteOne();

    let moderatorStats = null;
    if (req.user.role === "moderator") {
      moderatorStats = await User.findById(req.user._id).select(
        "email role issuesResolved score"
      );
    }

    return res.status(200).json({
      message: "Ticket deleted successfully.",
      moderatorStats,
    });
  } catch (error) {
    console.error("Error deleting ticket", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getTicket = async (req, res) => {
  try {
    const user = req.user;
    let ticket;

    if (user.role !== "user") {
      ticket = await Ticket.findById(req.params.id)
        .populate("assignedTo", ["email", "_id", "issuesResolved", "score"])
        .populate("resolvedBy", ["email", "_id", "issuesResolved", "score"]);
    } else {
      ticket = await Ticket.findOne({
        createdBy: user._id,
        _id: req.params.id,
      }).select("title description summary status createdAt resolvedAt");
    }

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found!" });
    }

    return res.status(200).json({ ticket });
  } catch (error) {
    console.error("Error fetching ticket.", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};
