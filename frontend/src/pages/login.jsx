import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotLink, setForgotLink] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/", { replace: true });
      } else {
        setError(data.error || data.message || "Login failed");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");
    setForgotLink("");
    setError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotMessage(data.error || "Unable to send reset link.");
        return;
      }
      setForgotMessage(data.message || "Reset link sent successfully.");
      if (data?.resetLink) {
        setForgotLink(data.resetLink);
      }
    } catch {
      setForgotMessage("Request failed. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="card w-full max-w-md shadow-2xl bg-base-100/95 border border-base-300">
        <form onSubmit={handleLogin} className="card-body gap-4">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold">Sign In to SupportDesk</h2>
            <p className="text-sm opacity-70">Track tickets, collaborate, and resolve faster.</p>
          </div>

          {error && (
            <div className="alert alert-error text-sm">
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="label text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              className="input input-bordered w-full"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="label text-sm font-medium">Password</label>
            <input
              type="password"
              name="password"
              placeholder="********"
              className="input input-bordered w-full"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="button"
            className="link link-hover text-sm text-right"
            onClick={() => {
              setShowForgot(true);
              setForgotEmail(form.email);
              setForgotMessage("");
            }}
          >
            Forgot password?
          </button>

          <div className="form-control mt-1">
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <span className="loading loading-spinner loading-sm"></span> : "Login"}
            </button>
          </div>

          <p className="text-center text-sm mt-2">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="link link-primary font-medium">
              Sign up
            </Link>
          </p>
        </form>
      </div>

      {showForgot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] grid place-items-center p-4">
          <div className="w-full max-w-md card bg-base-100 border border-base-300 shadow-2xl">
            <form className="card-body gap-3" onSubmit={handleForgotPassword}>
              <h3 className="text-lg font-semibold">Reset Password</h3>
              <p className="text-sm opacity-70">
                Enter your registered email and we will send a reset link.
              </p>
              <input
                type="email"
                className="input input-bordered"
                placeholder="you@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
              />
              {forgotMessage && (
                <div className="alert alert-info text-sm">
                  <span>{forgotMessage}</span>
                </div>
              )}
              {forgotLink && (
                <a className="link link-primary text-sm break-all" href={forgotLink}>
                  Open reset link
                </a>
              )}
              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowForgot(false)}
                  disabled={forgotLoading}
                >
                  Close
                </button>
                <button className="btn btn-primary" type="submit" disabled={forgotLoading}>
                  {forgotLoading ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    "Send Link"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
