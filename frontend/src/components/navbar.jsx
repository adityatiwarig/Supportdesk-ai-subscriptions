import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "light" ? "night" : "light"));

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost btn-circle btn-sm border border-base-300 hover:border-primary transition"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <span className="text-[10px] font-semibold" aria-hidden="true">
        {theme === "night" ? "DARK" : "LIGHT"}
      </span>
    </button>
  );
}

export default function Navbar() {
  const token = localStorage.getItem("token");
  let user = localStorage.getItem("user");
  if (user) {
    user = JSON.parse(user);
  }
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const initials = user?.email?.charAt(0).toUpperCase() || "?";

  return (
    <div className="navbar bg-base-100/85 backdrop-blur shadow-sm sticky top-0 z-50 px-4 border-b border-base-300">
      <div className="flex-1">
        <Link to="/" className="btn btn-ghost text-lg sm:text-xl gap-2 font-bold tracking-tight">
          <span className="w-7 h-7 rounded-md bg-primary/90 text-primary-content grid place-items-center text-xs">
            AI
          </span>
          <span>SupportDesk AI</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {!token ? (
          <>
            <Link to="/signup" className="btn btn-ghost btn-sm">
              Sign Up
            </Link>
            <Link to="/login" className="btn btn-primary btn-sm">
              Login
            </Link>
          </>
        ) : (
          <>
            {user?.role === "moderator" && (
              <Link to="/assigned-work" className="btn btn-outline btn-sm btn-info hidden sm:inline-flex">
                Assigned Work
              </Link>
            )}
            {user?.role === "admin" && (
              <Link to="/admin" className="btn btn-outline btn-sm btn-accent hidden sm:inline-flex">
                Admin Panel
              </Link>
            )}
            <div className="dropdown dropdown-end">
              <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-circle avatar placeholder ring-1 ring-base-300"
              >
                <div className="bg-primary text-primary-content rounded-full w-10">
                  <span>{initials}</span>
                </div>
              </div>
              <ul
                tabIndex={0}
                className="dropdown-content menu bg-base-100 rounded-box z-10 w-56 p-2 shadow-lg mt-2 border border-base-300"
              >
                <li className="menu-title px-4 py-2">
                  <span className="text-xs opacity-60">Signed in as</span>
                  <span className="text-sm font-medium truncate">{user?.email}</span>
                </li>
                <li className="px-4 py-1 text-xs opacity-70">Role: {user?.role}</li>
                {user?.role === "moderator" && (
                  <li className="sm:hidden">
                    <Link to="/assigned-work">Assigned Work</Link>
                  </li>
                )}
                {user?.role === "admin" && (
                  <li className="sm:hidden">
                    <Link to="/admin">Admin Panel</Link>
                  </li>
                )}
                <div className="divider my-0"></div>
                <li>
                  <button onClick={logout} className="text-error">
                    Logout
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
