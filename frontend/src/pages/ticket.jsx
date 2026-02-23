import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useToast } from "../components/toast-context.js";
import { timeAgo } from "../utils/timeAgo.js";
import StatusTimeline from "../components/status-timeline.jsx";
import { API_BASE_URL } from "../config/api.js";

const STATUS_BADGE = {
  Todo: "badge-ghost",
  TODO: "badge-info",
  IN_PROGRESS: "badge-warning",
  PENDING: "badge-warning",
  DONE: "badge-success",
  RESOLVED: "badge-success",
};

const PRIORITY_BADGE = {
  low: "badge-ghost",
  medium: "badge-warning",
  high: "badge-error",
};

const PROCESSING_STATUSES = ["Todo", "TODO"];

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

export default function TicketDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const intervalRef = useRef(null);
  const prevStatusRef = useRef(null);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const stopPolling = useCallback(() => {
    setPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchTicket = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`${API_BASE_URL}/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const t = data.ticket || data;
        setTicket(t);

        if (silent && prevStatusRef.current && prevStatusRef.current !== t.status) {
          toast.info(`Status updated: ${t.status.replace(/_/g, " ")}`);
        }
        prevStatusRef.current = t.status;

        if (!PROCESSING_STATUSES.includes(t.status)) {
          stopPolling();
        }
      } else if (!silent) {
        toast.error(data.message || "Failed to fetch ticket");
      }
    } catch (err) {
      console.error(err);
      if (!silent) toast.error("Something went wrong");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, stopPolling, toast, token]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    setPolling(true);
    intervalRef.current = setInterval(() => fetchTicket(true), 5000);
  }, [fetchTicket]);

  useEffect(() => {
    fetchTicket().then(() => {});
    return () => stopPolling();
  }, [fetchTicket, stopPolling]);

  useEffect(() => {
    if (ticket && PROCESSING_STATUSES.includes(ticket.status)) {
      startPolling();
    }
  }, [startPolling, ticket]);

  const canDelete =
    user?.role === "admin" ||
    (user?.role === "moderator" && String(ticket?.assignedTo?._id || "") === String(user?._id || ""));

  const handleDelete = async () => {
    const shouldDelete = window.confirm("Delete this ticket permanently?");
    if (!shouldDelete) return;

    try {
      setDeleting(true);
      const res = await fetch(`${API_BASE_URL}/tickets/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to delete ticket");
        return;
      }

      toast.success("Ticket deleted");
      const nextRoute = user?.role === "moderator" ? "/assigned-work" : "/";
      navigate(nextRoute, { replace: true });
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete ticket");
    } finally {
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );

  if (!ticket)
    return (
      <div className="text-center mt-20">
        <div className="text-5xl mb-4">Not Found</div>
        <p className="text-lg font-medium">Ticket not found</p>
        <Link to="/" className="btn btn-primary btn-sm mt-4">
          Back to Tickets
        </Link>
      </div>
    );

  const statusLabel = (ticket.status || "").replace(/_/g, " ");

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link to="/" className="btn btn-ghost btn-sm gap-1 -ml-2">
          Back to Tickets
        </Link>
        {canDelete && (
          <button className="btn btn-sm btn-error btn-outline" onClick={handleDelete} disabled={deleting}>
            {deleting ? <span className="loading loading-spinner loading-xs"></span> : "Delete Ticket"}
          </button>
        )}
      </div>

      {polling && (
        <div className="alert alert-info mb-4 text-sm">
          <span className="loading loading-dots loading-sm"></span>
          <span>AI is analyzing this ticket. Updates will appear automatically...</span>
        </div>
      )}

      <div className="card bg-base-100 shadow-lg border border-base-300">
        <div className="card-body space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="card-title text-2xl">{ticket.title}</h2>
            <div className="flex gap-2 flex-shrink-0">
              {ticket.status && (
                <span
                  className={`badge ${STATUS_BADGE[ticket.status] || "badge-ghost"} capitalize`}
                >
                  {statusLabel}
                </span>
              )}
              {ticket.priority && (
                <span
                  className={`badge ${PRIORITY_BADGE[ticket.priority] || "badge-ghost"} capitalize`}
                >
                  {ticket.priority}
                </span>
              )}
            </div>
          </div>

          {ticket.summary && (
            <div className="bg-base-200 rounded-lg p-3">
              <span className="text-xs opacity-50 block mb-1">AI Summary</span>
              <p className="text-sm leading-relaxed">{ticket.summary}</p>
            </div>
          )}

          <StatusTimeline status={ticket.status} assignedTo={ticket.assignedTo} />

          <div>
            <span className="text-xs opacity-50 block mb-1">Description</span>
            <p className="opacity-80 leading-relaxed">{ticket.description}</p>
          </div>

          {(ticket.assignedTo || ticket.relatedSkills?.length > 0 || ticket.createdAt) && (
            <>
              <div className="divider text-xs opacity-50">Details</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {ticket.assignedTo && (
                  <div className="bg-base-200 rounded-lg p-3">
                    <span className="text-xs opacity-50 block">Assigned To</span>
                    <span className="font-medium">{ticket.assignedTo?.email}</span>
                  </div>
                )}
                <div className="bg-base-200 rounded-lg p-3">
                  <span className="text-xs opacity-50 block">Created On</span>
                  <span className="font-medium">{formatDateTime(ticket.createdAt)}</span>
                  {ticket.createdAt && (
                    <span className="text-xs opacity-40 block">{timeAgo(ticket.createdAt)}</span>
                  )}
                </div>
                <div className="bg-base-200 rounded-lg p-3">
                  <span className="text-xs opacity-50 block">Resolved On</span>
                  <span className="font-medium">{formatDateTime(ticket.resolvedAt)}</span>
                </div>
                {ticket.resolvedBy && (
                  <div className="bg-base-200 rounded-lg p-3">
                    <span className="text-xs opacity-50 block">Resolved By</span>
                    <span className="font-medium">{ticket.resolvedBy?.email}</span>
                  </div>
                )}
                {ticket.deadline && (
                  <div className="bg-base-200 rounded-lg p-3">
                    <span className="text-xs opacity-50 block">Deadline</span>
                    <span className="font-medium">{formatDateTime(ticket.deadline)}</span>
                  </div>
                )}
              </div>

              {ticket.relatedSkills?.length > 0 && (
                <div>
                  <span className="text-xs opacity-50">Related Skills</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {ticket.relatedSkills.map((skill) => (
                      <span key={skill} className="badge badge-outline badge-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {ticket.helpfulNotes && (
            <>
              <div className="divider text-xs opacity-50">AI Notes</div>
              <div className="bg-base-200 rounded-lg p-4">
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{ticket.helpfulNotes}</ReactMarkdown>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


