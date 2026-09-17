import { useCallback, useEffect, useState } from "react";
import { Plus, Search, X, Pencil, Trash2, Ticket, ChevronLeft, ChevronRight } from "lucide-react";

// Coupon CRUD lives on the admin worker (same as users/orders/loyalty).
const API_BASE_URL = "https://aurelia-admin-worker.adeebibrahim01.workers.dev";
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

async function adminFetch(path, options = {}) {
    const token = localStorage.getItem("admin_auth_token");
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

function couponLabel(value, type) {
    const num = Number(value);
    if (Number.isNaN(num)) return "—";
    return type === "%" ? `${num}% OFF` : `$${num} OFF`;
}

// ─────────────────────────────────────────────────────────────
// Toasts + confirm popover (same pattern as AdminDeals)
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
                    className="min-w-[220px] max-w-xs border-l-2 bg-[#EDE6DA] px-4 py-3 text-xs text-[#432817] shadow-[0_4px_20px_rgba(67,40,23,0.12)]"
                    style={{ borderColor: borderColor[t.tone] || borderColor.neutral }}
                >
                    {t.message}
                </div>
            ))}
        </div>
    );
}

function ConfirmPopover({ request, onConfirm, onCancel }) {
    if (!request) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#432817]/25 px-4" onClick={onCancel}>
            <div className="w-full max-w-sm border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6" onClick={(e) => e.stopPropagation()}>
                <p className="font-serif text-lg leading-snug text-[#432817]">{request.title}</p>
                <p className="mt-2 text-xs leading-5 text-[#7E7E86]">{request.description}</p>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase hover:text-[#432817]">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} className="bg-[#432817] px-5 py-2 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720]">
                        {request.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

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

const STATUS_COLORS = {
    active: "#6B7A5E",
    scheduled: "#977150",
    expired: "#9B4635",
    disabled: "#7E7E86",
};

function StatusPill({ status }) {
    return (
        <span className="inline-flex items-center text-[11px] capitalize text-[#432817]">
            <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[status] || "#7E7E86" }}
            />
            {status}
        </span>
    );
}

// For <input type="datetime-local">, which needs "YYYY-MM-DDTHH:mm" —
// DB stores ISO strings, so trim to that shape both ways.
function toLocalInputValue(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInputValue(local) {
    if (!local) return null;
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ─────────────────────────────────────────────────────────────
// Create / edit modal
// ─────────────────────────────────────────────────────────────

const emptyForm = {
    code: "",
    description: "",
    type: "%",
    value: "",
    min_order_amount: "",
    max_discount_amount: "",
    starts_at: "",
    expires_at: "",
    usage_limit: "",
    per_user_limit: "",
    status: "active",
};

function CouponFormModal({ coupon, onClose, onSaved, push }) {
    const isEdit = Boolean(coupon);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (coupon) {
            setForm({
                code: coupon.code || "",
                description: coupon.description || "",
                type: coupon.type || "%",
                value: coupon.value ?? "",
                min_order_amount: coupon.min_order_amount ?? "",
                max_discount_amount: coupon.max_discount_amount ?? "",
                starts_at: toLocalInputValue(coupon.starts_at),
                expires_at: toLocalInputValue(coupon.expires_at),
                usage_limit: coupon.usage_limit ?? "",
                per_user_limit: coupon.per_user_limit ?? "",
                status: coupon.status || "active",
            });
        } else {
            setForm(emptyForm);
        }
    }, [coupon]);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.code.trim()) return push("Coupon code is required.", "bad");
        if (form.value === "" || isNaN(Number(form.value)) || Number(form.value) <= 0) {
            return push("Coupon value must be a positive number.", "bad");
        }
        if (form.type === "%" && Number(form.value) > 100) {
            return push("Percentage discount can't exceed 100.", "bad");
        }

        const payload = {
            code: form.code.trim().toUpperCase(),
            description: form.description.trim() || null,
            type: form.type,
            value: Number(form.value),
            min_order_amount: form.min_order_amount === "" ? 0 : Number(form.min_order_amount),
            max_discount_amount: form.max_discount_amount === "" ? null : Number(form.max_discount_amount),
            starts_at: fromLocalInputValue(form.starts_at),
            expires_at: fromLocalInputValue(form.expires_at),
            usage_limit: form.usage_limit === "" ? null : Number(form.usage_limit),
            per_user_limit: form.per_user_limit === "" ? null : Number(form.per_user_limit),
            status: form.status,
        };

        setSaving(true);
        try {
            if (isEdit) {
                await adminFetch(`/admin/coupons/${coupon.id}`, { method: "PATCH", body: JSON.stringify(payload) });
                push("Coupon updated.", "good");
            } else {
                await adminFetch("/admin/coupons", { method: "POST", body: JSON.stringify(payload) });
                push("Coupon created.", "good");
            }
            onSaved();
        } catch (err) {
            push(err.message || "Could not save the coupon.", "bad");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#432817]/25 px-4" onClick={onClose}>
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[88vh] w-full max-w-lg overflow-y-auto border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6"
            >
                <div className="flex items-start justify-between">
                    <p className="font-serif text-lg leading-snug text-[#432817]">{isEdit ? "Edit coupon" : "New coupon"}</p>
                    <button type="button" onClick={onClose} className="text-[#7E7E86] hover:text-[#432817]">
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-5 space-y-5">
                    <div>
                        <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Coupon code
                        </label>
                        <input
                            type="text"
                            value={form.code}
                            onChange={(e) => setField("code", e.target.value)}
                            placeholder="SUMMER20"
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs uppercase outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Description (internal)
                        </label>
                        <input
                            type="text"
                            value={form.description}
                            onChange={(e) => setField("description", e.target.value)}
                            placeholder="20% off summer collection"
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                        />
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Value
                            </label>
                            <input
                                type="number"
                                value={form.value}
                                onChange={(e) => setField("value", e.target.value)}
                                placeholder="20"
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                            />
                        </div>
                        <div className="w-28">
                            <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Type
                            </label>
                            <select
                                value={form.type}
                                onChange={(e) => setField("type", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            >
                                <option value="%">%</option>
                                <option value="$">$</option>
                            </select>
                        </div>
                    </div>

                    <p className="text-[11px] text-[#977150]">
                        Preview: <span className="font-medium">{form.value !== "" ? couponLabel(form.value, form.type) : "—"}</span>
                    </p>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Minimum order amount
                            </label>
                            <input
                                type="number" min="0" value={form.min_order_amount}
                                onChange={(e) => setField("min_order_amount", e.target.value)}
                                placeholder="0"
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Max discount cap
                            </label>
                            <input
                                type="number" min="0" value={form.max_discount_amount}
                                onChange={(e) => setField("max_discount_amount", e.target.value)}
                                placeholder="No cap"
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Starts at
                            </label>
                            <input
                                type="datetime-local" value={form.starts_at}
                                onChange={(e) => setField("starts_at", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Expires at
                            </label>
                            <input
                                type="datetime-local" value={form.expires_at}
                                onChange={(e) => setField("expires_at", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Total usage limit
                            </label>
                            <input
                                type="number" min="0" value={form.usage_limit}
                                onChange={(e) => setField("usage_limit", e.target.value)}
                                placeholder="Unlimited"
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Per-user limit
                            </label>
                            <input
                                type="number" min="0" value={form.per_user_limit}
                                onChange={(e) => setField("per_user_limit", e.target.value)}
                                placeholder="Unlimited"
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Status
                        </label>
                        <select
                            value={form.status}
                            onChange={(e) => setField("status", e.target.value)}
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                        >
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                        </select>
                        <p className="mt-1 text-[10px] text-[#7E7E86]">
                            Scheduled/expired status is derived automatically from the dates above.
                        </p>
                    </div>
                </div>

                <div className="mt-7 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase hover:text-[#432817]">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-[#432817] px-5 py-2 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720] disabled:opacity-50"
                    >
                        {saving ? "Saving…" : isEdit ? "Save changes" : "Create coupon"}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export default function AdminCoupons() {
    const { toasts, push } = useToasts();

    const [coupons, setCoupons] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const [formModal, setFormModal] = useState(null); // null | "new" | couponObject
    const [confirmRequest, setConfirmRequest] = useState(null);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchInput]);

    const loadCoupons = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");
        try {
            const params = new URLSearchParams({ page, limit: PAGE_SIZE, search });
            if (statusFilter) params.set("status", statusFilter);
            const res = await adminFetch(`/admin/coupons?${params.toString()}`);
            setCoupons(res.coupons);
            setTotal(res.total);
        } catch (err) {
            setErrorMessage(err.message || "Could not load coupons. Try again in a moment.");
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter]);

    useEffect(() => {
        loadCoupons();
    }, [loadCoupons]);

    const requestDelete = (coupon) => {
        setConfirmRequest({
            title: "Delete this coupon?",
            description: `"${coupon.code}" will stop working immediately. This can't be undone.`,
            confirmLabel: "Delete",
            action: async () => {
                try {
                    await adminFetch(`/admin/coupons/${coupon.id}`, { method: "DELETE" });
                    push(`"${coupon.code}" deleted.`, "good");
                    loadCoupons();
                } catch (err) {
                    push(err.message || "Could not delete the coupon.", "bad");
                }
            },
        });
    };

    const handleConfirm = () => {
        const action = confirmRequest?.action;
        setConfirmRequest(null);
        action?.();
    };

    return (
        <div>
            <ToastStack toasts={toasts} />
            <ConfirmPopover request={confirmRequest} onConfirm={handleConfirm} onCancel={() => setConfirmRequest(null)} />
            {formModal && (
                <CouponFormModal
                    coupon={formModal === "new" ? null : formModal}
                    onClose={() => setFormModal(null)}
                    onSaved={() => {
                        setFormModal(null);
                        loadCoupons();
                    }}
                    push={push}
                />
            )}

            {/* Search + filter + new coupon */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative max-w-md flex-1">
                        <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#7E7E86]" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search coupons by code"
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 pl-6 pr-6 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                        />
                        {searchInput && (
                            <button type="button" onClick={() => setSearchInput("")} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#7E7E86] hover:text-[#432817]">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                    >
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="expired">Expired</option>
                        <option value="disabled">Disabled</option>
                    </select>
                </div>
                <button
                    type="button"
                    onClick={() => setFormModal("new")}
                    className="flex items-center gap-2 bg-[#432817] px-5 py-2.5 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720]"
                >
                    <Plus size={13} /> New coupon
                </button>
            </div>

            {errorMessage && (
                <div className="mb-5 border-l-2 border-[#9B4635] bg-[#9B4635]/5 px-4 py-3 text-xs text-[#7a3226]">
                    {errorMessage}
                </div>
            )}

            {/* Coupons table */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-xs">
                    <thead>
                        <tr className="border-b border-[#D1B79E]/60 text-[9px] uppercase tracking-[0.15em] text-[#7E7E86]">
                            <th className="px-4 py-3">Code</th>
                            <th className="px-4 py-3">Discount</th>
                            <th className="px-4 py-3">Min order</th>
                            <th className="px-4 py-3">Usage</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                        ) : coupons.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-14 text-center">
                                    <p className="font-serif text-lg text-[#432817]">No coupons match that search.</p>
                                    <p className="mt-1 text-[11px] text-[#7E7E86]">
                                        Try a different code, or{" "}
                                        <button
                                            type="button"
                                            onClick={() => { setSearchInput(""); setStatusFilter(""); }}
                                            className="underline decoration-[#977150] underline-offset-2 hover:text-[#432817]"
                                        >
                                            clear the filters
                                        </button>
                                        .
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            coupons.map((coupon) => (
                                <tr
                                    key={coupon.id}
                                    className="border-b border-[#D1B79E]/30 transition-colors last:border-0 hover:bg-[#432817]/[0.03]"
                                >
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#D1B79E]/40">
                                                <Ticket size={14} className="text-[#7E7E86]" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-[#432817]">{coupon.code}</p>
                                                {coupon.description && (
                                                    <p className="truncate text-[10px] text-[#7E7E86]">{coupon.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 font-medium text-[#432817]">
                                        {coupon.label || couponLabel(coupon.value, coupon.type)}
                                    </td>
                                    <td className="px-4 py-3.5 text-[#7E7E86]">
                                        {Number(coupon.min_order_amount) > 0 ? `$${Number(coupon.min_order_amount).toFixed(2)}` : "—"}
                                    </td>
                                    <td className="px-4 py-3.5 text-[#7E7E86]">
                                        {coupon.used_count}
                                        {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <StatusPill status={coupon.derived_status || coupon.status} />
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex justify-end gap-3 text-[10px] font-medium tracking-[0.08em] uppercase">
                                            <button
                                                type="button"
                                                onClick={() => setFormModal(coupon)}
                                                className="flex items-center gap-1 text-[#432817] underline decoration-[#D1B79E] underline-offset-3 hover:decoration-[#432817]"
                                            >
                                                <Pencil size={11} /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => requestDelete(coupon)}
                                                className="flex items-center gap-1 text-[#9B4635] underline decoration-[#D1B79E] underline-offset-3 hover:decoration-[#9B4635]"
                                            >
                                                <Trash2 size={11} /> Delete
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
                    Page {page} of {totalPages} · {total} coupon{total === 1 ? "" : "s"}
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
        </div>
    );
}
