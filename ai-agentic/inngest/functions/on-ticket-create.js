import { NonRetriableError } from "inngest";
import Ticket from "../../models/ticket.js";
import { inngest } from "../client.js";
import { processTicketAgent } from "../../services/ticket-agent.js";

export const onTicketCreated = inngest.createFunction(
  { id: "on-ticket-created", retries: 2 },
  { event: "ticket/created" },
  async ({ event, step }) => {
    try {
      const { ticketId } = event.data;

      const ticket = await step.run("fetch-ticket", async () => {
        const ticketObject = await Ticket.findById(ticketId);
        if (!ticketObject) {
          throw new NonRetriableError("Ticket not found!");
        }
        return ticketObject;
      });

      await step.run("process-ticket-agent", async () => {
        return processTicketAgent({ ticketId: ticket._id, sendNotification: true });
      });

      return { success: true };
    } catch (error) {
      console.error("Error running on-ticket-created:", error.message);
      return { success: false, error: error.message };
    }
  }
);
