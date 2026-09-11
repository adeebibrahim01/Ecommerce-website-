import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Search,
    X,
    LogOut,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    ShieldAlert,
    Package,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const API_BASE_URL = "https://ecommerce-website.adeebibrahim01.workers.dev";
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

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

// ─────────────────────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────────────────────

const AVATAR_TONES = ["#432817", "#7A4A28", "#977150", "#8C6C4F", "#5E3A22"];

// Ab yeh karein:
function monogramTone(name) {
    const safeName = name || "";
    const code = safeName.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return AVATAR_TONES[code % AVATAR_TONES.length];
}
function Monogram({ name, size = 32 }) {
    const initials = (name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("");
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-full font-serif text-[11px] text-[#EDE6DA]"
            style={{ backgroundColor: monogramTone(name), width: size, height: size }}
        >
            {initials || "?"}
        </div>
    );
}

function StatusDot({ status }) {
    const colors = { active: "#6B7A5E", blocked: "#9B4635", deleted: "#7E7E86", paid: "#6B7A5E", pending: "#977150", failed: "#9B4635" };
    return (
        <span
            className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors[status] || "#7E7E86" }}
        />
    );
}

function RoleMark({ role }) {
    if (role === "admin") {
        return (
            <span className="inline-flex items-center gap-1 text-[#432817]">
                <ShieldAlert size={12} strokeWidth={1.75} />
                <span className="text-[10px] font-medium tracking-[0.12em]">Admin</span>
            </span>
        );
    }
    return <span className="text-[10px] tracking-[0.12em] text-[#7E7E86]">Member</span>;
}

/** Counts up from 0 to `value` once, on mount/value-change — the one deliberate motion moment. */
function useCountUp(value, durationMs = 700) {
    const [display, setDisplay] = useState(0);
    const prefersReducedMotion = useRef(
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ).current;

    useEffect(() => {
        if (value === null || value === undefined) return;
        if (prefersReducedMotion) {
            setDisplay(value);
            return;
        }
        let raf;
        const start = performance.now();
        const from = 0;
        const tick = (now) => {
            const progress = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(from + (value - from) * eased));
            if (progress < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value, durationMs, prefersReducedMotion]);

    return value === null || value === undefined ? null : display;
}

function LedgerStat({ label, value }) {
    const display = useCountUp(value);
    return (
        <div className="flex flex-col px-6 py-5 first:pl-0 last:pr-0">
            <span className="font-serif text-[32px] leading-none text-[#432817]">
                {display === null ? "—" : display.toLocaleString()}
            </span>
            <span className="mt-2 text-[9px] font-medium tracking-[0.2em] text-[#7E7E86] uppercase">{label}</span>
        </div>
    );
}

function money(n) {
    const num = Number(n);
    return Number.isFinite(num) ? `$${num.toFixed(2)}` : "—";
}

// ─────────────────────────────────────────────────────────────
// Toast system (replaces browser alert())
// ─────────────────────────────────────────────────────────────

function useToasts() {
    const [toasts, setToasts] = useState([]);

    const push = useCallback((message, tone = "neutral") => {
        const id = Math.random().toString(36).slice(2);
        setToasts((prev) => [...prev, { id, message, tone }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
    }, []);

    return { toasts, push };
}

function ToastStack({ toasts }) {
    if (toasts.length === 0) return null;
    const borderColor = { good: "#6B7A5E", bad: "#9B4635", neutral: "#432817" };
    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className="min-w-[220px] max-w-xs border-l-2 bg-[#EDE6DA] px-4 py-3 text-xs text-[#432817] shadow-[0_4px_20px_rgba(67,40,23,0.12)] animate-[toastIn_0.25s_ease-out]"
                    style={{ borderColor: borderColor[t.tone] || borderColor.neutral }}
                >
                    {t.message}
                </div>
            ))}
            <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Confirm popover (replaces browser confirm())
// ─────────────────────────────────────────────────────────────

function ConfirmPopover({ request, onConfirm, onCancel }) {
    if (!request) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#432817]/25 px-4" onClick={onCancel}>
            <div
                className="w-full max-w-sm border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="font-serif text-lg leading-snug text-[#432817]">{request.title}</p>
                <p className="mt-2 text-xs leading-5 text-[#7E7E86]">{request.description}</p>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase hover:text-[#432817]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="bg-[#432817] px-5 py-2 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720]"
                    >
                        {request.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Order detail popover — shows an order's line items
// ─────────────────────────────────────────────────────────────

function OrderDetailPopover({ order, items, loading, onClose }) {
    if (!order) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#432817]/25 px-4" onClick={onClose}>
            <div
                className="max-h-[85vh] w-full max-w-lg overflow-y-auto border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <p className="font-serif text-lg leading-snug text-[#432817]">{order.order_number}</p>
                        <p className="mt-1 text-xs text-[#7E7E86]">
                            {order.user_name || "Unknown"} · {order.user_email || `User #${order.user_id}`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-[#7E7E86] hover:text-[#432817]">
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-4 flex items-center gap-2 text-[11px] text-[#432817]">
                    <StatusDot status={order.status} />
                    <span className="capitalize">{order.status}</span>
                    <span className="text-[#D1B79E]">·</span>
                    <span className="capitalize text-[#7E7E86]">{order.payment_method || "card"}</span>
                    <span className="text-[#D1B79E]">·</span>
                    <span className="text-[#7E7E86]">
                        {order.created_at ? new Date(order.created_at + "Z").toLocaleString() : "—"}
                    </span>
                </div>

                <div className="mt-5 border-t border-[#D1B79E]/60 pt-4">
                    {loading ? (
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-10 w-full animate-pulse rounded-sm bg-[#D1B79E]/30" />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-xs text-[#7E7E86]">No items found for this order.</p>
                    ) : (
                        <div className="divide-y divide-[#D1B79E]/40">
                            {items.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 py-3">
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="h-10 w-10 shrink-0 rounded-sm object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#D1B79E]/40">
                                            <Package size={14} className="text-[#7E7E86]" />
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-medium text-[#432817]">{item.name}</p>
                                        <p className="text-[10px] text-[#7E7E86]">
                                            {item.quantity} × {money(item.price)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-xs font-medium text-[#432817]">
                                        {money(item.line_total)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-4 space-y-1.5 border-t border-[#D1B79E]/60 pt-4 text-xs">
                    <div className="flex justify-between text-[#7E7E86]">
                        <span>Subtotal</span>
                        <span>{money(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[#7E7E86]">
                        <span>Shipping</span>
                        <span>{money(order.shipping)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-[#432817]">
                        <span>Total</span>
                        <span>{money(order.total)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Skeleton row (replaces plain "Loading users..." text)
// ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols = 6 }) {
    return (
        <tr className="border-b border-[#D1B79E]/30">
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-4">
                    <div className="h-3 w-full max-w-[120px] animate-pulse rounded-sm bg-[#D1B79E]/40" />
                </td>
            ))}
            <td className="px-4 py-4" />
        </tr>
    );
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

const SORTABLE_COLUMNS = {
    name: { label: "Name", key: "name" },
    role: { label: "Role", key: "role" },
    status: { label: "Status", key: "status" },
    created_at: { label: "Joined", key: "created_at" },
};

const ORDER_SORTABLE_COLUMNS = {
    order_number: { label: "Order", key: "order_number" },
    status: { label: "Status", key: "status" },
    total: { label: "Total", key: "total" },
    created_at: { label: "Date", key: "created_at" },
};

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { toasts, push } = useToasts();

    const [activeTab, setActiveTab] = useState("users"); // "users" | "orders"

    const [stats, setStats] = useState(null);

    // ---- Users tab state ----
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");
    const [busyUserId, setBusyUserId] = useState(null);
    const [sort, setSort] = useState({ key: "created_at", dir: "desc" });
    const [confirmRequest, setConfirmRequest] = useState(null);

    // ---- Orders tab state ----
    const [orders, setOrders] = useState([]);
    const [ordersTotal, setOrdersTotal] = useState(0);
    const [ordersPage, setOrdersPage] = useState(1);
    const [ordersSearchInput, setOrdersSearchInput] = useState("");
    const [ordersSearch, setOrdersSearch] = useState("");
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState("");
    const [ordersSort, setOrdersSort] = useState({ key: "created_at", dir: "desc" });
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedOrderItems, setSelectedOrderItems] = useState([]);
    const [orderDetailLoading, setOrderDetailLoading] = useState(false);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const ordersTotalPages = Math.max(1, Math.ceil(ordersTotal / PAGE_SIZE));

    // Debounce user search input -> search
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Debounce order search input -> search
    useEffect(() => {
        const t = setTimeout(() => {
            setOrdersSearch(ordersSearchInput.trim());
            setOrdersPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [ordersSearchInput]);

    // Stats load once, regardless of tab
    useEffect(() => {
        adminFetch("/admin/stats")
            .then((res) => setStats(res.stats))
            .catch(() => { });
    }, []);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");
        try {
            const usersRes = await adminFetch(`/admin/users?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`);
            setUsers(usersRes.users);
            setTotal(usersRes.total);
        } catch (err) {
            setErrorMessage(err.message || "Could not reach the registry. Try again in a moment.");
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        if (activeTab === "users") loadUsers();
    }, [activeTab, loadUsers]);

    const loadOrders = useCallback(async () => {
        setOrdersLoading(true);
        setOrdersError("");
        try {
            const ordersRes = await adminFetch(
                `/admin/orders?page=${ordersPage}&limit=${PAGE_SIZE}&search=${encodeURIComponent(ordersSearch)}`
            );
            setOrders(ordersRes.orders);
            setOrdersTotal(ordersRes.total);
        } catch (err) {
            setOrdersError(err.message || "Could not reach the orders ledger. Try again in a moment.");
        } finally {
            setOrdersLoading(false);
        }
    }, [ordersPage, ordersSearch]);

    useEffect(() => {
        if (activeTab === "orders") loadOrders();
    }, [activeTab, loadOrders]);

    const sortedUsers = useMemo(() => {
        const copy = [...users];
        const { key, dir } = sort;
        copy.sort((a, b) => {
            const av = (a[key] ?? "").toString().toLowerCase();
            const bv = (b[key] ?? "").toString().toLowerCase();
            if (av < bv) return dir === "asc" ? -1 : 1;
            if (av > bv) return dir === "asc" ? 1 : -1;
            return 0;
        });
        return copy;
    }, [users, sort]);

    const sortedOrders = useMemo(() => {
        const copy = [...orders];
        const { key, dir } = ordersSort;
        copy.sort((a, b) => {
            const av = (a[key] ?? "").toString().toLowerCase();
            const bv = (b[key] ?? "").toString().toLowerCase();
            if (av < bv) return dir === "asc" ? -1 : 1;
            if (av > bv) return dir === "asc" ? 1 : -1;
            return 0;
        });
        return copy;
    }, [orders, ordersSort]);

    const toggleSort = (key) => {
        setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    };

    const toggleOrdersSort = (key) => {
        setOrdersSort((prev) =>
            prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
        );
    };

    const openOrderDetail = async (order) => {
        setSelectedOrder(order);
        setSelectedOrderItems([]);
        setOrderDetailLoading(true);
        try {
            const res = await adminFetch(`/admin/orders/${order.id}`);
            setSelectedOrder(res.order);
            setSelectedOrderItems(res.items || []);
        } catch (err) {
            push(err.message || "Could not load order details.", "bad");
            setSelectedOrder(null);
        } finally {
            setOrderDetailLoading(false);
        }
    };

    const requestRoleChange = (targetUser) => {
        const nextRole = targetUser.role === "admin" ? "user" : "admin";
        setConfirmRequest({
            title: nextRole === "admin" ? "Promote to admin?" : "Remove admin access?",
            description: `${targetUser.email} will ${nextRole === "admin" ? "gain" : "lose"} access to the admin portal immediately.`,
            confirmLabel: nextRole === "admin" ? "Promote" : "Demote",
            action: async () => {
                setBusyUserId(targetUser.id);
                try {
                    await adminFetch(`/admin/users/${targetUser.id}/role`, {
                        method: "PATCH",
                        body: JSON.stringify({ role: nextRole }),
                    });
                    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, role: nextRole } : u)));
                    push(`${targetUser.name} is now ${nextRole === "admin" ? "an admin" : "a member"}.`, "good");
                } catch (err) {
                    push(err.message || "Could not update role.", "bad");
                } finally {
                    setBusyUserId(null);
                }
            },
        });
    };

    const requestStatusChange = (targetUser) => {
        const nextStatus = targetUser.status === "blocked" ? "active" : "blocked";
        setConfirmRequest({
            title: nextStatus === "blocked" ? "Block this account?" : "Unblock this account?",
            description:
                nextStatus === "blocked"
                    ? `${targetUser.email} will lose access until unblocked.`
                    : `${targetUser.email} will be able to sign in again.`,
            confirmLabel: nextStatus === "blocked" ? "Block" : "Unblock",
            action: async () => {
                setBusyUserId(targetUser.id);
                try {
                    await adminFetch(`/admin/users/${targetUser.id}/status`, {
                        method: "PATCH",
                        body: JSON.stringify({ status: nextStatus }),
                    });
                    setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, status: nextStatus } : u)));
                    push(`${targetUser.name} is now ${nextStatus}.`, nextStatus === "blocked" ? "bad" : "good");
                } catch (err) {
                    push(err.message || "Could not update status.", "bad");
                } finally {
                    setBusyUserId(null);
                }
            },
        });
    };

    const handleConfirm = () => {
        const action = confirmRequest?.action;
        setConfirmRequest(null);
        action?.();
    };

    const SortHeader = ({ colKey }) => {
        const col = SORTABLE_COLUMNS[colKey];
        const active = sort.key === colKey;
        return (
            <button
                type="button"
                onClick={() => toggleSort(colKey)}
                className={`flex items-center gap-1 uppercase tracking-[0.15em] transition-colors ${active ? "text-[#432817]" : "text-[#7E7E86] hover:text-[#432817]"
                    }`}
            >
                {col.label}
                {active && (sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
            </button>
        );
    };

    const OrderSortHeader = ({ colKey }) => {
        const col = ORDER_SORTABLE_COLUMNS[colKey];
        const active = ordersSort.key === colKey;
        return (
            <button
                type="button"
                onClick={() => toggleOrdersSort(colKey)}
                className={`flex items-center gap-1 uppercase tracking-[0.15em] transition-colors ${active ? "text-[#432817]" : "text-[#7E7E86] hover:text-[#432817]"
                    }`}
            >
                {col.label}
                {active && (ordersSort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
            </button>
        );
    };

    return (
        <main className="min-h-screen bg-[#EDE6DA] text-[#432817]">
            <ToastStack toasts={toasts} />
            <ConfirmPopover request={confirmRequest} onConfirm={handleConfirm} onCancel={() => setConfirmRequest(null)} />
            <OrderDetailPopover
                order={selectedOrder}
                items={selectedOrderItems}
                loading={orderDetailLoading}
                onClose={() => setSelectedOrder(null)}
            />

            {/* Header */}
            <header className="flex items-center justify-between border-b border-[#D1B79E]/60 px-6 py-5 sm:px-10">
                <div className="flex items-center gap-4">
                    <button type="button" onClick={() => navigate("/admin")} className="font-serif text-xl tracking-[0.16em]">
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
                {/* Page intro */}
                <div className="mb-8">
                    <h1 className="font-serif text-4xl tracking-tight text-[#432817]">
                        {activeTab === "users" ? "The Member Registry" : "The Order Ledger"}
                    </h1>
                    <p className="mt-2 max-w-md text-xs leading-6 text-[#7E7E86]">
                        {activeTab === "users"
                            ? "Every account that has ever signed in to AURELIA — verified through Google, or the long way, with a password and a code sent to their inbox."
                            : "Every order placed and paid for on AURELIA. Open one to see exactly what the customer bought."}
                    </p>
                </div>

                {/* Ledger stats strip */}
                <div className="mb-8 flex flex-wrap divide-x divide-[#D1B79E]/60 border-y border-[#D1B79E]/60">
                    <LedgerStat label="Total members" value={stats?.total_users} />
                    <LedgerStat label="Admins" value={stats?.total_admins} />
                    <LedgerStat label="Active" value={stats?.active_users} />
                    <LedgerStat label="Blocked" value={stats?.blocked_users} />
                    <LedgerStat label="Verified" value={stats?.verified_users} />
                </div>

                {/* Tabs */}
                <div className="mb-6 flex gap-6 border-b border-[#D1B79E]/60">
                    <button
                        type="button"
                        onClick={() => setActiveTab("users")}
                        className={`-mb-px border-b-2 px-1 pb-3 text-[10px] font-medium tracking-[0.18em] uppercase transition-colors ${activeTab === "users"
                            ? "border-[#432817] text-[#432817]"
                            : "border-transparent text-[#7E7E86] hover:text-[#432817]"
                            }`}
                    >
                        Users
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("orders")}
                        className={`-mb-px border-b-2 px-1 pb-3 text-[10px] font-medium tracking-[0.18em] uppercase transition-colors ${activeTab === "orders"
                            ? "border-[#432817] text-[#432817]"
                            : "border-transparent text-[#7E7E86] hover:text-[#432817]"
                            }`}
                    >
                        Orders
                    </button>
                </div>

                {activeTab === "users" ? (
                    <>
                        {/* Search */}
                        <div className="mb-6 flex max-w-md items-center gap-2">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#7E7E86]" />
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Search by name or email"
                                    className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 pl-6 pr-6 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                                />
                                {searchInput && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchInput("")}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 text-[#7E7E86] hover:text-[#432817]"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {errorMessage && (
                            <div className="mb-5 border-l-2 border-[#9B4635] bg-[#9B4635]/5 px-4 py-3 text-xs text-[#7a3226]">
                                {errorMessage}
                            </div>
                        )}

                        {/* Users table */}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-xs">
                                <thead>
                                    <tr className="border-b border-[#D1B79E]/60 text-[9px]">
                                        <th className="px-4 py-3">
                                            <SortHeader colKey="name" />
                                        </th>
                                        <th className="px-4 py-3 text-[#7E7E86] uppercase tracking-[0.15em]">Email</th>
                                        <th className="px-4 py-3">
                                            <SortHeader colKey="role" />
                                        </th>
                                        <th className="px-4 py-3">
                                            <SortHeader colKey="status" />
                                        </th>
                                        <th className="px-4 py-3 text-[#7E7E86] uppercase tracking-[0.15em]">Verified</th>
                                        <th className="px-4 py-3">
                                            <SortHeader colKey="created_at" />
                                        </th>
                                        <th className="px-4 py-3 text-right text-[#7E7E86] uppercase tracking-[0.15em]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                                    ) : sortedUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-14 text-center">
                                                <p className="font-serif text-lg text-[#432817]">No one matches that search.</p>
                                                <p className="mt-1 text-[11px] text-[#7E7E86]">
                                                    Try a different name or email, or{" "}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSearchInput("")}
                                                        className="underline decoration-[#977150] underline-offset-2 hover:text-[#432817]"
                                                    >
                                                        clear the search
                                                    </button>
                                                    .
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedUsers.map((u) => (
                                            <tr
                                                key={u.id}
                                                className="border-b border-[#D1B79E]/30 transition-colors last:border-0 hover:bg-[#432817]/[0.03]"
                                            >
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <Monogram name={u.name} />
                                                        <span className="font-medium">{u.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-[#7E7E86]">{u.email}</td>
                                                <td className="px-4 py-3.5">
                                                    <RoleMark role={u.role} />
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="inline-flex items-center text-[11px] capitalize text-[#432817]">
                                                        <StatusDot status={u.status} />
                                                        {u.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-[#7E7E86]">{u.is_verified ? "Yes" : "No"}</td>
                                                <td className="px-4 py-3.5 text-[#7E7E86]">
                                                    {u.created_at ? new Date(u.created_at + "Z").toLocaleDateString() : "—"}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex justify-end gap-3 text-[10px] font-medium tracking-[0.08em] uppercase">
                                                        <button
                                                            type="button"
                                                            disabled={busyUserId === u.id}
                                                            onClick={() => requestRoleChange(u)}
                                                            className="text-[#432817] underline decoration-[#D1B79E] underline-offset-3 hover:decoration-[#432817] disabled:opacity-40"
                                                        >
                                                            {u.role === "admin" ? "Demote" : "Promote"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={busyUserId === u.id}
                                                            onClick={() => requestStatusChange(u)}
                                                            className="text-[#9B4635] underline decoration-[#D1B79E] underline-offset-3 hover:decoration-[#9B4635] disabled:opacity-40"
                                                        >
                                                            {u.status === "blocked" ? "Unblock" : "Block"}
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
                        <div className="mt-6 flex items-center justify-between text-[11px] text-[#7E7E86]">
                            <span>
                                Page {page} of {totalPages} · {total} member{total === 1 ? "" : "s"}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="flex items-center gap-1 px-3 py-1.5 uppercase tracking-wide hover:text-[#432817] disabled:opacity-30"
                                >
                                    <ChevronLeft size={13} /> Prev
                                </button>
                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="flex items-center gap-1 px-3 py-1.5 uppercase tracking-wide hover:text-[#432817] disabled:opacity-30"
                                >
                                    Next <ChevronRight size={13} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Order search */}
                        <div className="mb-6 flex max-w-md items-center gap-2">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#7E7E86]" />
                                <input
                                    type="text"
                                    value={ordersSearchInput}
                                    onChange={(e) => setOrdersSearchInput(e.target.value)}
                                    placeholder="Search by order number, name or email"
                                    className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 pl-6 pr-6 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                                />
                                {ordersSearchInput && (
                                    <button
                                        type="button"
                                        onClick={() => setOrdersSearchInput("")}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 text-[#7E7E86] hover:text-[#432817]"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {ordersError && (
                            <div className="mb-5 border-l-2 border-[#9B4635] bg-[#9B4635]/5 px-4 py-3 text-xs text-[#7a3226]">
                                {ordersError}
                            </div>
                        )}

                        {/* Orders table */}
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-left text-xs">
                                <thead>
                                    <tr className="border-b border-[#D1B79E]/60 text-[9px]">
                                        <th className="px-4 py-3">
                                            <OrderSortHeader colKey="order_number" />
                                        </th>
                                        <th className="px-4 py-3 text-[#7E7E86] uppercase tracking-[0.15em]">Customer</th>
                                        <th className="px-4 py-3">
                                            <OrderSortHeader colKey="status" />
                                        </th>
                                        <th className="px-4 py-3">
                                            <OrderSortHeader colKey="total" />
                                        </th>
                                        <th className="px-4 py-3">
                                            <OrderSortHeader colKey="created_at" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ordersLoading ? (
                                        Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                                    ) : sortedOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-14 text-center">
                                                <p className="font-serif text-lg text-[#432817]">No orders match that search.</p>
                                                <p className="mt-1 text-[11px] text-[#7E7E86]">
                                                    Try a different order number, name or email, or{" "}
                                                    <button
                                                        type="button"
                                                        onClick={() => setOrdersSearchInput("")}
                                                        className="underline decoration-[#977150] underline-offset-2 hover:text-[#432817]"
                                                    >
                                                        clear the search
                                                    </button>
                                                    .
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedOrders.map((o) => (
                                            <tr
                                                key={o.id}
                                                onClick={() => openOrderDetail(o)}
                                                className="cursor-pointer border-b border-[#D1B79E]/30 transition-colors last:border-0 hover:bg-[#432817]/[0.03]"
                                            >
                                                <td className="px-4 py-3.5 font-medium">{o.order_number}</td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <Monogram name={o.user_name || o.user_email} size={26} />
                                                        <div className="min-w-0">
                                                            <p className="truncate">{o.user_name || "Unknown"}</p>
                                                            <p className="truncate text-[10px] text-[#7E7E86]">{o.user_email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="inline-flex items-center text-[11px] capitalize text-[#432817]">
                                                        <StatusDot status={o.status} />
                                                        {o.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 font-medium">{money(o.total)}</td>
                                                <td className="px-4 py-3.5 text-[#7E7E86]">
                                                    {o.created_at ? new Date(o.created_at + "Z").toLocaleDateString() : "—"}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="mt-6 flex items-center justify-between text-[11px] text-[#7E7E86]">
                            <span>
                                Page {ordersPage} of {ordersTotalPages} · {ordersTotal} order{ordersTotal === 1 ? "" : "s"}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    disabled={ordersPage <= 1}
                                    onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                                    className="flex items-center gap-1 px-3 py-1.5 uppercase tracking-wide hover:text-[#432817] disabled:opacity-30"
                                >
                                    <ChevronLeft size={13} /> Prev
                                </button>
                                <button
                                    type="button"
                                    disabled={ordersPage >= ordersTotalPages}
                                    onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                                    className="flex items-center gap-1 px-3 py-1.5 uppercase tracking-wide hover:text-[#432817] disabled:opacity-30"
                                >
                                    Next <ChevronRight size={13} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}