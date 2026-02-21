import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../components/toast-context.js";

const STATUS_BADGE = {
  Todo: "badge-ghost",
  TODO: "badge-info",
  IN_PROGRESS: "badge-warning",
  PENDING: "badge-warning",
  DONE: "badge-success",
  RESOLVED: "badge-success",
  CLOSED: "badge-success",
};

const PRIORITY_BADGE = {
  low: "badge-ghost",
  medium: "badge-warning",
  high: "badge-error",
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

function StatusLabel({ status }) {
  if (!status) return null;
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={`badge ${STATUS_BADGE[status] || "badge-ghost"} badge-sm whitespace-nowrap capitalize`}
    >
      {label}
    </span>
  );
}

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const safeParseJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getApiErrorMessage = (payload, fallback) =>
  payload?.message || payload?.error || payload?.details || fallback;

function SubscriptionModal({ open, onClose, token, onCreditsRefresh }) {
  const toast = useToast();
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState({ amountInr: 499, creditsToAdd: 25, mode: "razorpay" });

  useEffect(() => {
    if (!open) return;
    setError("");
    setSuccess(false);
    fetch(`${import.meta.env.VITE_SERVER_URL}/payments/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.amountInr && data?.creditsToAdd) {
          setPlan({
            amountInr: data.amountInr,
            creditsToAdd: data.creditsToAdd,
            mode: data.mode || "razorpay",
          });
        }
      })
      .catch(() => {});
  }, [open, token]);

  const handlePayment = async () => {
    setLoading(true);
    setError("");

    try {
      const orderRes = await fetch(`${import.meta.env.VITE_SERVER_URL}/payments/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const orderData = await safeParseJson(orderRes);
      if (!orderRes.ok) {
        throw new Error(
          getApiErrorMessage(orderData, "Unable to start payment. Please try again.")
        );
      }
      if (!orderData?.orderId || !orderData?.keyId) {
        throw new Error("Payment provider configuration is incomplete on server.");
      }

      if (orderData.mode === "mock" || plan.mode === "mock") {
        setVerifying(true);
        const verifyRes = await fetch(`${import.meta.env.VITE_SERVER_URL}/payments/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            razorpay_order_id: orderData.orderId,
            razorpay_payment_id: `mock_pay_${Date.now()}`,
            razorpay_signature: "mock_signature",
          }),
        });

        const verifyData = await safeParseJson(verifyRes);
        if (!verifyRes.ok) {
          throw new Error(
            getApiErrorMessage(verifyData, "Subscription activation failed. Please retry.")
          );
        }

        setSuccess(true);
        toast.success("Subscription successful. Credits added.");
        if (verifyData?.user) {
          localStorage.setItem(
            "user",
            JSON.stringify({ ...JSON.parse(localStorage.getItem("user") || "{}"), ...verifyData.user })
          );
        }
        await onCreditsRefresh();
        setVerifying(false);
        setLoading(false);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Razorpay SDK failed to load.");
      }

      const razorpay = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "SupportDesk AI",
        description: `${orderData.plan.creditsToAdd} credits subscription`,
        order_id: orderData.orderId,
        prefill: {
          name: cardholderName || orderData.user?.name || "",
          email: orderData.user?.email || "",
        },
        theme: { color: "#2563eb" },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        handler: async (response) => {
          setVerifying(true);
          try {
            const verifyRes = await fetch(`${import.meta.env.VITE_SERVER_URL}/payments/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(response),
            });
            const verifyData = await safeParseJson(verifyRes);
            if (!verifyRes.ok) {
              throw new Error(
                getApiErrorMessage(verifyData, "Payment verification failed. Please retry.")
              );
            }

            setSuccess(true);
            toast.success("Subscription successful. Credits added.");
            if (verifyData?.user) {
              localStorage.setItem("user", JSON.stringify({ ...JSON.parse(localStorage.getItem("user") || "{}"), ...verifyData.user }));
            }
            await onCreditsRefresh();
          } catch (verifyError) {
            setError(verifyError.message || "Verification failed.");
            toast.error(verifyError.message || "Verification failed.");
          } finally {
            setVerifying(false);
            setLoading(false);
          }
        },
      });

      razorpay.on("payment.failed", (failure) => {
        setLoading(false);
        setVerifying(false);
        const reason =
          failure?.error?.description ||
          failure?.error?.reason ||
          failure?.error?.step ||
          "Payment failed.";
        setError(reason);
        toast.error(reason);
      });

      razorpay.open();
    } catch (paymentError) {
      setLoading(false);
      setVerifying(false);
      const reason = paymentError?.message || "Payment failed.";
      setError(reason);
      toast.error(reason);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-base-300 bg-base-100 shadow-2xl">
        <div className="p-6 border-b border-base-300">
          <h3 className="text-xl font-bold">Upgrade Subscription</h3>
          <p className="text-sm opacity-70 mt-1">
            Add {plan.creditsToAdd} credits for INR {plan.amountInr}.
          </p>
          {plan.mode === "mock" && (
            <p className="text-xs text-warning mt-2">
              Mock mode enabled: this is a local simulated payment.
            </p>
          )}
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="rounded-xl border border-success/40 bg-success/10 p-6 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-full border-2 border-success grid place-items-center text-success text-2xl animate-bounce">
                ✓
              </div>
              <p className="text-lg font-semibold">Subscription Activated</p>
              <p className="text-sm opacity-70">Credits were added to your account.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input input-bordered col-span-2"
                  placeholder="Cardholder name"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                />
                <input
                  className="input input-bordered col-span-2"
                  placeholder="Card number"
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                />
                <input
                  className="input input-bordered"
                  placeholder="MM/YY"
                  maxLength={5}
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
                <input
                  className="input input-bordered"
                  placeholder="CVV"
                  maxLength={4}
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 text-xs opacity-70">
                <span className="badge badge-outline">VISA</span>
                <span className="badge badge-outline">Mastercard</span>
                <span className="badge badge-outline">RuPay</span>
                <span className="badge badge-success badge-outline">Secure Lock</span>
              </div>

              {error && (
                <div className="alert alert-error text-sm">
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 pb-6 flex items-center justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading || verifying}>
            {success ? "Close" : "Cancel"}
          </button>
          {!success && (
            <button className="btn btn-primary min-w-36" onClick={handlePayment} disabled={loading || verifying}>
              {loading || verifying ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  {verifying ? "Verifying..." : "Processing..."}
                </>
              ) : (
                `Pay INR ${plan.amountInr}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Tickets() {
  const [form, setForm] = useState({ title: "", description: "" });
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [credits, setCredits] = useState({
    creditsRemaining: 0,
    creditsUsed: 0,
    subscriptionStatus: "inactive",
  });
  const [creditsFetching, setCreditsFetching] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const toast = useToast();

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const canDeleteTickets = user?.role === "admin" || user?.role === "moderator";
  const isEndUser = user?.role === "user";
  const noCreditsLeft = isEndUser && credits.creditsRemaining <= 0;
  const canDeleteTicket = (ticket) =>
    user?.role === "admin" ||
    (user?.role === "moderator" && String(ticket?.assignedTo?._id || "") === String(user?._id || ""));

  const refreshCredits = useCallback(async () => {
    if (!isEndUser) {
      setCreditsFetching(false);
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/payments/credits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.user) {
        setCredits({
          creditsRemaining: Number(data.user.creditsRemaining || 0),
          creditsUsed: Number(data.user.creditsUsed || 0),
          subscriptionStatus: data.user.subscriptionStatus || "inactive",
        });
        localStorage.setItem("user", JSON.stringify({ ...JSON.parse(localStorage.getItem("user") || "{}"), ...data.user }));
      }
    } catch (error) {
      console.error("Failed to refresh credits", error);
    } finally {
      setCreditsFetching(false);
    }
  }, [isEndUser, token]);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
        method: "GET",
      });
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : data.tickets || []);
    } catch (err) {
      console.error("Failed to fetch tickets:", err);
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTickets();
    if (isEndUser) {
      refreshCredits();
    } else {
      setCreditsFetching(false);
    }
  }, [fetchTickets, isEndUser, refreshCredits]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        !search ||
        t.title?.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase()) ||
        t.summary?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchPriority =
        priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    const s = { total: tickets.length, todo: 0, inProgress: 0, done: 0, high: 0 };
    tickets.forEach((t) => {
      const st = (t.status || "").toUpperCase().replace(/[\s-]/g, "_");
      if (st === "TODO" || st === "PENDING") s.todo++;
      else if (st === "IN_PROGRESS") s.inProgress++;
      else if (st === "DONE" || st === "CLOSED" || st === "RESOLVED") s.done++;
      if (t.priority === "high") s.high++;
    });
    return s;
  }, [tickets]);

  const statuses = useMemo(
    () => [...new Set(tickets.map((t) => t.status).filter(Boolean))],
    [tickets]
  );
  const priorities = useMemo(
    () => [...new Set(tickets.map((t) => t.priority).filter(Boolean))],
    [tickets]
  );

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (noCreditsLeft) {
      setShowSubscriptionModal(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setForm({ title: "", description: "" });
        toast.success("Ticket created! AI is analyzing it...");
        if (data?.credits) {
          setCredits({
            creditsRemaining: Number(data.credits.creditsRemaining || 0),
            creditsUsed: Number(data.credits.creditsUsed || 0),
            subscriptionStatus: data.credits.subscriptionStatus || "inactive",
          });
        }
        fetchTickets();
      } else {
        if (data?.code === "CREDIT_EXHAUSTED") {
          setShowSubscriptionModal(true);
        }
        toast.error(data.message || "Ticket creation failed");
      }
    } catch (err) {
      toast.error("Error creating ticket");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTicket = async (e, ticket) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canDeleteTickets) return;

    const shouldDelete = window.confirm(`Delete "${ticket.title}" permanently?`);
    if (!shouldDelete) return;

    try {
      setDeletingId(ticket._id);
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/tickets/${ticket._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to delete ticket");
        return;
      }

      setTickets((prev) => prev.filter((t) => t._id !== ticket._id));
      toast.success("Ticket deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete ticket");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {isEndUser ? (
        <div className="mb-6 p-5 rounded-2xl border border-primary/25 bg-base-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide opacity-60">Credits Remaining</p>
            <p className="text-3xl font-extrabold text-primary">
              {creditsFetching ? "..." : credits.creditsRemaining}
            </p>
            <p className="text-xs opacity-60 mt-1">
              Used: {credits.creditsUsed} | Subscription: {credits.subscriptionStatus}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowSubscriptionModal(true)}>
            Buy Subscription
          </button>
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-2xl border border-success/25 bg-base-100 shadow-sm">
          <p className="text-sm font-semibold text-success">Unlimited tickets enabled for {user?.role}.</p>
        </div>
      )}

      {!fetching && tickets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="stat bg-base-100 rounded-xl border border-base-300 p-4">
            <div className="stat-title text-xs">Total</div>
            <div className="stat-value text-2xl">{stats.total}</div>
          </div>
          <div className="stat bg-base-100 rounded-xl border border-base-300 p-4">
            <div className="stat-title text-xs">Queued</div>
            <div className="stat-value text-2xl text-info">{stats.todo}</div>
          </div>
          <div className="stat bg-base-100 rounded-xl border border-base-300 p-4">
            <div className="stat-title text-xs">In Progress</div>
            <div className="stat-value text-2xl text-warning">{stats.inProgress}</div>
          </div>
          <div className="stat bg-base-100 rounded-xl border border-base-300 p-4">
            <div className="stat-title text-xs">High Priority</div>
            <div className="stat-value text-2xl text-error">{stats.high}</div>
          </div>
        </div>
      )}

      <div className="card bg-base-100/95 shadow-lg border border-base-300 mb-8">
        <div className="card-body">
          <h2 className="card-title text-xl">Create a New Ticket</h2>
          {noCreditsLeft && (
            <div className="alert alert-warning text-sm">
              <span>Credits are exhausted. Subscribe to continue creating tickets.</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="What's the issue?"
              className="input input-bordered w-full"
              required
            />
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe your issue in detail..."
              className="textarea textarea-bordered w-full min-h-24"
              required
            ></textarea>
            <button className="btn btn-primary" type="submit" disabled={loading || noCreditsLeft}>
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Submitting...
                </>
              ) : noCreditsLeft ? (
                "Subscription Required"
              ) : (
                "Submit Ticket"
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <h2 className="text-xl font-bold flex-shrink-0">
          {user?.role === "user" ? "Your Tickets" : "Ticket Queue"}
        </h2>
        <div className="flex flex-1 flex-wrap gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search tickets..."
            className="input input-bordered input-sm flex-1 min-w-48"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {statuses.length > 0 && (
            <select
              className="select select-bordered select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}
          {priorities.length > 0 && (
            <select
              className="select select-bordered select-sm"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priority</option>
              {priorities.map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>
        <span className="badge badge-neutral badge-sm whitespace-nowrap">
          {filtered.length} of {tickets.length}
        </span>
      </div>

      {fetching ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 opacity-60">
          <div className="text-5xl mb-4">No Tickets</div>
          <p className="text-lg font-medium">No tickets yet</p>
          <p className="text-sm">Create your first ticket above to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 opacity-60">
          <p>No tickets match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <Link
              key={ticket._id}
              className="card bg-base-100 shadow border border-base-300 hover:border-primary/40 hover:shadow-md transition-shadow block"
              to={`/tickets/${ticket._id}`}
            >
              <div className="card-body p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{ticket.title}</h3>
                    <p className="text-sm opacity-70 line-clamp-2 mt-1">{ticket.description}</p>
                    {ticket.summary && (
                      <p className="text-xs opacity-70 mt-1 line-clamp-2">AI Summary: {ticket.summary}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    {ticket.priority && (
                      <span
                        className={`badge ${PRIORITY_BADGE[ticket.priority] || "badge-ghost"} badge-sm capitalize`}
                      >
                        {ticket.priority}
                      </span>
                    )}
                    <StatusLabel status={ticket.status} />
                    {canDeleteTickets && canDeleteTicket(ticket) && (
                      <button
                        className="btn btn-xs btn-error btn-outline"
                        onClick={(e) => handleDeleteTicket(e, ticket)}
                        disabled={deletingId === ticket._id}
                      >
                        {deletingId === ticket._id ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          "Delete"
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs opacity-70 flex flex-wrap gap-3">
                  <span>Created: {formatDateTime(ticket.createdAt)}</span>
                  <span>Resolved: {formatDateTime(ticket.resolvedAt)}</span>
                  {ticket.assignedTo && <span>Assigned: {ticket.assignedTo.email}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {isEndUser && (
        <SubscriptionModal
          open={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          token={token}
          onCreditsRefresh={refreshCredits}
        />
      )}
    </div>
  );
}

