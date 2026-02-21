import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const ROLE_BADGE = {
  admin: "badge-error",
  moderator: "badge-warning",
  user: "badge-info",
};

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ role: "", skills: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (!token || user?.role !== "admin") {
      navigate("/", { replace: true });
      return;
    }

    fetchUsers();
  }, []);

  const moderatorStats = useMemo(() => {
    const moderators = users.filter((u) => u.role === "moderator");
    const totalSolved = moderators.reduce((sum, mod) => sum + (mod.issuesResolved || 0), 0);
    const totalScore = moderators.reduce((sum, mod) => sum + (mod.score || 0), 0);
    return { moderators: moderators.length, totalSolved, totalScore };
  }, [users]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/auth/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data);
        setFilteredUsers(data);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error("Error fetching users", err);
    }
  };

  const handleEditClick = (user) => {
    setEditingUser(user.email);
    setFormData({
      role: user.role,
      skills: user.skills?.join(", "),
    });
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/auth/update-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: editingUser,
            role: formData.role,
            skills: formData.skills
              .split(",")
              .map((skill) => skill.trim())
              .filter(Boolean),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        console.error(data.error || "Failed to update user");
        return;
      }

      setEditingUser(null);
      setFormData({ role: "", skills: "" });
      fetchUsers();
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    setFilteredUsers(users.filter((user) => user.email.toLowerCase().includes(query)));
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/" className="btn btn-ghost btn-sm gap-1 -ml-2 mb-2">
            Back
          </Link>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm opacity-60 mt-1">Manage users, roles, skills, and moderator performance.</p>
        </div>
        <span className="badge badge-neutral">{filteredUsers.length} users</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="stat bg-base-100 border border-base-300 rounded-lg p-4">
          <div className="stat-title text-xs">Moderators</div>
          <div className="stat-value text-2xl">{moderatorStats.moderators}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-lg p-4">
          <div className="stat-title text-xs">Issues Solved</div>
          <div className="stat-value text-2xl text-success">{moderatorStats.totalSolved}</div>
        </div>
        <div className="stat bg-base-100 border border-base-300 rounded-lg p-4">
          <div className="stat-title text-xs">Moderator Score</div>
          <div className="stat-value text-2xl text-info">{moderatorStats.totalScore}</div>
        </div>
      </div>

      <div className="relative mb-6">
        <input
          type="text"
          className="input input-bordered w-full"
          placeholder="Search by email..."
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div key={user._id} className="card bg-base-100 shadow border border-base-300">
            <div className="card-body p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar placeholder">
                    <div className="bg-neutral text-neutral-content rounded-full w-10">
                      <span className="text-sm">{user.email?.charAt(0).toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`badge badge-sm ${ROLE_BADGE[user.role] || "badge-ghost"}`}>
                        {user.role}
                      </span>
                      {user.skills && user.skills.length > 0 && (
                        <span className="text-xs opacity-50">{user.skills.length} skill(s)</span>
                      )}
                      {user.role === "moderator" && (
                        <>
                          <span className="badge badge-sm badge-success">
                            Solved: {user.issuesResolved || 0}
                          </span>
                          <span className="badge badge-sm badge-info">Score: {user.score || 0}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {editingUser !== user.email && (
                  <button
                    className="btn btn-outline btn-sm btn-primary"
                    onClick={() => handleEditClick(user)}
                  >
                    Edit
                  </button>
                )}
              </div>

              {user.skills && user.skills.length > 0 && editingUser !== user.email && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {user.skills.map((skill) => (
                    <span key={skill} className="badge badge-outline badge-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              {editingUser === user.email && (
                <div className="mt-4 space-y-3 bg-base-200 rounded-lg p-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium opacity-60">Role</label>
                    <select
                      className="select select-bordered select-sm w-full"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium opacity-60">Skills</label>
                    <input
                      type="text"
                      placeholder="e.g. React, Node.js, Python"
                      className="input input-bordered input-sm w-full"
                      value={formData.skills}
                      onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button className="btn btn-primary btn-sm" onClick={handleUpdate} disabled={saving}>
                      {saving ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : (
                        "Save Changes"
                      )}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingUser(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 opacity-60">
            <p>No users found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
