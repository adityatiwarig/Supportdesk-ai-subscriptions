import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/auth/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed.");
        return;
      }
      setSuccess(data.message || "Password reset successful.");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="card w-full max-w-md shadow-2xl bg-base-100/95 border border-base-300">
        <form onSubmit={handleSubmit} className="card-body gap-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Set New Password</h2>
            <p className="text-sm opacity-70 mt-1">Create a secure new password for your account.</p>
          </div>

          {error && (
            <div className="alert alert-error text-sm">
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="alert alert-success text-sm">
              <span>{success}</span>
            </div>
          )}

          <input
            type="password"
            className="input input-bordered"
            placeholder="New password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required
          />
          <input
            type="password"
            className="input input-bordered"
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            required
          />

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-sm"></span> : "Reset Password"}
          </button>
          <Link to="/login" className="btn btn-ghost">
            Back to Login
          </Link>
        </form>
      </div>
    </div>
  );
}
