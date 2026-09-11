import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ShieldCheck, ShieldOff, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const API_BASE_URL = "https://ecommerce-website.adeebibrahim01.workers.dev";
const PAGE_SIZE = 10;

async function adminFetch(path, options = {}) {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
}

function StatCard({ label, value }) {
    return (
        <div className="border border-[#D1B79E]/60 bg-[#f7f3ec] px-5 py-4">
            <p className="text-[9px] font-medium tracking-[0.2em] text-[#7E7E86] uppercase">{label}</p>
            <p className="mt-2 font-serif text-3xl text-[#432817]">{value ?? "—"}</p>
        </div>
    );
}

function Badge({ children, tone = "neutral" }) {
    const tones = {
        neutral: "bg-[#EDE6DA] text-[#7E7E86]",
        good: "bg-emerald-50 text-emerald-700",
        bad: "bg-red-50 text-red-600",
        accent: "bg-[#432817] text-[#EDE6DA]",
    };
    return (
        <span className={`inline-block px-2 py-1 text-[9px] font-medium tracking-[0.1em] uppercase ${tones[tone]}`}>
            {children}
        </span>
    );
}

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [busyUserId, setBusyUserId] = useState(null);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const loadData = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");
        try {
            const [statsRes, usersRes] = await Promise.all([
                adminFetch("/admin/stats"),
                adminFetch(`/admin/users?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`),
            ]);
            setStats(statsRes.stats);
            setUsers(usersRes.users);
            setTotal(usersRes.total);
        } catch (err) {
            setErrorMessage(err.message || "Failed to load admin data.");
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setPage(1);
        loadData();
    };

    const toggleRole = async (targetUser) => {
        const nextRole = targetUser.role === "admin" ? "user" : "admin";
        if (!window.confirm(`Change ${targetUser.email} to "${nextRole}"?`)) return;

        setBusyUserId(targetUser.id);
        try {
            await adminFetch(`/admin/users/${targetUser.id}/role`, {
                method: "PATCH",
                body: JSON.stringify({ role: nextRole }),
            });
            setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: nextRole } : u)));
        } catch (err) {
            alert(err.message || "Failed to update role.");
        } finally {
            setBusyUserId(null);
        }
    };

    const toggleStatus = async (targetUser) => {
        const nextStatus = targetUser.status === "blocked" ? "active" : "blocked";
        if (!window.confirm(`${nextStatus === "blocked" ? "Block" : "Unblock"} ${targetUser.email}?`)) return;

        setBusyUserId(targetUser.id);
        try {
            await adminFetch(`/admin/users/${targetUser.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: nextStatus }),
            });
            setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, status: nextStatus } : u)));
        } catch (err) {
            alert(err.message || "Failed to update status.");
        } finally {
            setBusyUserId(null);
        }
    };

    return (
        <main className="min-h-screen bg-[#EDE6DA] text-[#432817]">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-[#D1B79E]/60 px-6 py-5 sm:px-10">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate("/admin")}
                        className="font-serif text-xl tracking-[0.16em]"
                    >
                        AURELIA
                    </button>
                    <span className="border-l border-[#D1B79E] pl-4 text-[10px] font-medium tracking-[0.25em] text-[#977150] uppercase">
                        Admin Portal
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="hidden text-xs text-[#7E7E86] sm:inline">{user?.email}</span>
                    <button
                        type="button"
                        onClick={logout}
                        className="flex items-center gap-2 border border-[#A78361] px-4 py-2 text-[9px] font-medium tracking-[0.18em] uppercase transition hover:bg-[#432817] hover:text-[#EDE6DA]"
                    >
                        <LogOut size={13} /> Logout
                    </button>
                </div>
            </header>

            <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
                {/* Stats */}
                <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-5">
                    <StatCard label="Total Users" value={stats?.total_users} />
                    <StatCard label="Admins" value={stats?.total_admins} />
                    <StatCard label="Active" value={stats?.active_users} />
                    <StatCard label="Blocked" value={stats?.blocked_users} />
                    <StatCard label="Verified" value={stats?.verified_users} />
                </div>

                {/* Search */}
                <form onSubmit={handleSearchSubmit} className="mb-6 flex max-w-md items-center gap-2">
                    <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7E7E86]" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or email..."
                            className="w-full border border-[#D1B79E] bg-white/40 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#432817]"
                        />
                    </div>
                    <button
                        type="submit"
                        className="bg-[#432817] px-5 py-2.5 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720]"
                    >
                        Search
                    </button>
                </form>

                {errorMessage && <p className="mb-4 text-xs text-red-600">{errorMessage}</p>}

                {/* Users table */}
                <div className="overflow-x-auto border border-[#D1B79E]/60 bg-white/30">
                    <table className="w-full min-w-[720px] text-left text-xs">
                        <thead>
                            <tr className="border-b border-[#D1B79E]/60 text-[9px] uppercase tracking-[0.15em] text-[#7E7E86]">
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Verified</th>
                                <th className="px-4 py-3">Joined</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-[#7E7E86]">
                                        Loading users...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-[#7E7E86]">
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                users.map((u) => (
                                    <tr key={u.id} className="border-b border-[#D1B79E]/30 last:border-0">
                                        <td className="px-4 py-3 font-medium">{u.name}</td>
                                        <td className="px-4 py-3 text-[#7E7E86]">{u.email}</td>
                                        <td className="px-4 py-3">
                                            <Badge tone={u.role === "admin" ? "accent" : "neutral"}>{u.role}</Badge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge tone={u.status === "active" ? "good" : "bad"}>{u.status}</Badge>
                                        </td>
                                        <td className="px-4 py-3">{u.is_verified ? "Yes" : "No"}</td>
                                        <td className="px-4 py-3 text-[#7E7E86]">
                                            {u.created_at ? new Date(u.created_at + "Z").toLocaleDateString() : "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    disabled={busyUserId === u.id}
                                                    onClick={() => toggleRole(u)}
                                                    title={u.role === "admin" ? "Demote to user" : "Promote to admin"}
                                                    className="border border-[#D1B79E] p-1.5 text-[#432817] transition hover:bg-[#432817] hover:text-[#EDE6DA] disabled:opacity-40"
                                                >
                                                    <ShieldCheck size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={busyUserId === u.id}
                                                    onClick={() => toggleStatus(u)}
                                                    title={u.status === "blocked" ? "Unblock user" : "Block user"}
                                                    className="border border-[#D1B79E] p-1.5 text-[#432817] transition hover:bg-red-700 hover:text-white disabled:opacity-40"
                                                >
                                                    <ShieldOff size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="mt-5 flex items-center justify-between text-xs text-[#7E7E86]">
                    <span>
                        Page {page} of {totalPages} · {total} users
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="flex items-center gap-1 border border-[#D1B79E] px-3 py-1.5 uppercase tracking-wide disabled:opacity-30"
                        >
                            <ChevronLeft size={13} /> Prev
                        </button>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="flex items-center gap-1 border border-[#D1B79E] px-3 py-1.5 uppercase tracking-wide disabled:opacity-30"
                        >
                            Next <ChevronRight size={13} />
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}