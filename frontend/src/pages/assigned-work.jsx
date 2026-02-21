import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../components/toast-context.js";

const STATUS_BADGE = {
  PENDING: "badge-warning",
  RESOLVED: "badge-success",
  TODO: "badge-info",
  Todo: "badge-info",
};

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AssignedWorkPage() {
  const [tickets, setTickets] = useState([]);
  const [solvedHistory, setSolvedHistory] = useState([]);
  const [moderatorStats, setModeratorStats] = useState({ issuesResolved: 0, score: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const navigate = useNavigate();
  const toast = useToast();

  const fetchAssignedTickets = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/tickets/assigned`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to fetch assigned tickets");
        return;
      }

      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setSolvedHistory(Array.isArray(data.solvedHistory) ? data.solvedHistory : []);
      if (data.moderatorStats) {
        setModeratorStats({
          issuesResolved: data.moderatorStats.issuesResolved || 0,
          score: data.moderatorStats.score || 0,
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch assigned tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || user?.role !== "moderator") {
      navigate("/", { replace: true });
      return;
    }

    fetchAssignedTickets();
  }, []);

  const updateStatus = async (ticketId, nextStatus) => {
    try {
      setUpdatingId(ticketId);

      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/tickets/${ticketId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to update status");
        return;
      }

      const updatedTicket = data.ticket;
      if (updatedTicket.status === "RESOLVED") {
        setTickets((prev) => prev.filter((ticket) => ticket._id !== ticketId));
        setSolvedHistory((prev) => [
          {
            ticketId: updatedTicket._id,
            title: updatedTicket.title,
            status: updatedTicket.status,
            resolvedAt: updatedTicket.resolvedAt,
            deletedAt: null,
            createdAt: updatedTicket.createdAt,
          },
          ...prev,
        ]);
      } else {
        setTickets((prev) =>
          prev.map((ticket) => (ticket._id === ticketId ? updatedTicket : ticket))
        );
      }

      if (data.moderatorStats) {
        setModeratorStats({
          issuesResolved: data.moderatorStats.issuesResolved || 0,
          score: data.moderatorStats.score || 0,
        });
      }

      toast.success(`Ticket marked as ${updatedTicket.status}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingId("");
    }
  };

  const deleteTicket = async (ticketId) => {
    const shouldDelete = window.confirm(
      "Delete this ticket? This action cannot be undone."
    );
    if (!shouldDelete) return;

    try {
      setUpdatingId(ticketId);
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/tickets/${ticketId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to delete ticket");
        return;
      }

      setTickets((prev) => prev.filter((ticket) => ticket._id !== ticketId));

      if (data.moderatorStats) {
        setModeratorStats({
          issuesResolved: data.moderatorStats.issuesResolved || 0,
          score: data.moderatorStats.score || 0,
        });
      }

      toast.success("Ticket deleted successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete ticket");
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="btn btn-ghost btn-sm -ml-2 mb-2">
            Back
          </Link>
          <h1 className="text-2xl font-bold">Assigned Work</h1>
          <p className="text-sm opacity-60">
            Manage active work and keep a private history of solved tickets.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="badge badge-neutral">{tickets.length} active</span>
          <span className="badge badge-secondary">{solvedHistory.length} solved history</span>
          <span className="badge badge-success">Solved: {moderatorStats.issuesResolved}</span>
          <span className="badge badge-info">Score: {moderatorStats.score}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5">
          <section className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Active Assigned Tickets</h2>
                <span className="badge badge-neutral">{tickets.length}</span>
              </div>

              {tickets.length === 0 ? (
                <div className="text-center py-14 opacity-60">
                  <p className="text-lg font-medium">No active tickets right now.</p>
                </div>
              ) : (
                <div className="space-y-3 mt-1">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket._id}
                      className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="card-body p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{ticket.title}</p>
                            <p className="text-sm opacity-70 mt-1 line-clamp-2">{ticket.description}</p>
                          </div>
                          <span className={`badge ${STATUS_BADGE[ticket.status] || "badge-ghost"}`}>
                            {ticket.status}
                          </span>
                        </div>

                        <div className="text-xs opacity-70 mt-2 flex flex-wrap gap-3">
                          <span>Created: {formatDateTime(ticket.createdAt)}</span>
                          <span>Resolved: {formatDateTime(ticket.resolvedAt)}</span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className="btn btn-sm btn-warning"
                            disabled={updatingId === ticket._id || ticket.status === "PENDING"}
                            onClick={() => updateStatus(ticket._id, "PENDING")}
                          >
                            Mark Pending
                          </button>
                          <button
                            className="btn btn-sm btn-success"
                            disabled={updatingId === ticket._id || ticket.status === "RESOLVED"}
                            onClick={() => updateStatus(ticket._id, "RESOLVED")}
                          >
                            Mark Resolved
                          </button>
                          <Link to={`/tickets/${ticket._id}`} className="btn btn-sm btn-outline">
                            Open Ticket
                          </Link>
                          <button
                            className="btn btn-sm btn-error btn-outline"
                            disabled={updatingId === ticket._id}
                            onClick={() => deleteTicket(ticket._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold">Solved Ticket History</h2>
                <span className="badge badge-success badge-sm">{solvedHistory.length}</span>
              </div>
              <p className="text-xs opacity-60 mb-3">
                Moderator-only history. Titles only, no descriptions.
              </p>

              {solvedHistory.length === 0 ? (
                <p className="opacity-60 text-sm py-4">No solved tickets yet.</p>
              ) : (
                <div className="space-y-2">
                  {solvedHistory.map((ticket) => (
                    <div
                      key={`${ticket.ticketId || ticket._id || ticket.title}-${ticket.resolvedAt || ""}`}
                      className="rounded-lg border border-base-300 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ticket.title}</p>
                        <p className="text-xs opacity-60">
                          Resolved: {formatDateTime(ticket.resolvedAt)}
                        </p>
                        {ticket.deletedAt && (
                          <p className="text-[11px] text-warning mt-1">
                            Ticket deleted from app
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

