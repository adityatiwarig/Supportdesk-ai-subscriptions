import Ticket from "../models/ticket.js";
import User from "../models/user.js";
import analyzeTicket from "../utils/ai.js";
import { sendMail } from "../utils/mailer.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findBestAssignee = async ({ normalizedSkills, createdBy }) => {
  let user = null;

  if (normalizedSkills.length) {
    const safeRegex = normalizedSkills.map(escapeRegex).join("|");

    user = await User.findOne({
      role: "moderator",
      skills: {
        $elemMatch: {
          $regex: safeRegex,
          $options: "i",
        },
      },
    }).sort({ issuesResolved: 1, score: 1, createdAt: 1 });
  }

  if (!user) {
    user = await User.findOne({ role: "moderator" }).sort({
      issuesResolved: 1,
      score: 1,
      createdAt: 1,
    });
  }

  if (!user) {
    user = await User.findOne({ role: "admin" }).sort({ createdAt: 1 });
  }

  if (!user && createdBy) {
    user = await User.findById(createdBy);
  }

  return user;
};

export const processTicketAgent = async ({ ticketId, sendNotification = true }) => {
  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  await Ticket.findByIdAndUpdate(ticket._id, { status: "TODO" });

  const aiResponse = await analyzeTicket(ticket);

  const normalizedSkills = Array.isArray(aiResponse?.relatedSkills)
    ? aiResponse.relatedSkills.filter(Boolean)
    : [];

  await Ticket.findByIdAndUpdate(ticket._id, {
    summary: aiResponse?.summary || "Summary unavailable.",
    priority: aiResponse?.priority || "medium",
    helpfulNotes:
      aiResponse?.helpfulNotes ||
      "AI analysis unavailable. Moderator can proceed manually.",
    relatedSkills: normalizedSkills,
    status: "PENDING",
  });

  const assignee = await findBestAssignee({
    normalizedSkills,
    createdBy: ticket.createdBy,
  });

  await Ticket.findByIdAndUpdate(ticket._id, {
    assignedTo: assignee?._id || null,
  });

  const updatedTicket = await Ticket.findById(ticket._id)
    .populate("assignedTo", ["email", "_id"])
    .populate("resolvedBy", ["email", "_id"]);

  if (sendNotification && assignee?.email) {
    try {
      await sendMail(
        assignee.email,
        "Ticket Assigned",
        `A new ticket is assigned to you: ${updatedTicket?.title || "Untitled ticket"}`
      );
    } catch (error) {
      console.error("Email notification failed:", error.message);
    }
  }

  return { ticket: updatedTicket, assignee };
};
