import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X, Save, Award } from "lucide-react";

const API_BASE_URL = "https://aurelia-admin-worker.adeebibrahim01.workers.dev";
const PAGE_SIZE = 10;

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

function TypeTag({ type }) {
    const map = {
        earn: { label: "Earned", color: "#6B7A5E" },
        redeem: { label: "Redeemed", color: "#9B4635" },
        adjust: { label: "Adjusted", color: "#977150" },
    };
    const t = map[type] || { label: type, color: "#7E7E86" };
    return (
        <span className="inline-flex items-center text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: t.color }}>
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
        </span>
    );
}

export default function AdminLoyalty() {
    const { toasts, push } = useToasts();

    // ---- Settings ----
    const [settings, setSettings] = useState(null);
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    const loadSettings = useCallback(async () => {
        setSettingsLoading(true);
        try {
            const data = await adminFetch("/admin/loyalty/settings");
            setSettings(data.settings);
        } catch (err) {
            push(err.message || "Settings load nahi ho sakin.", "bad");
        } finally {
            setSettingsLoading(false);
        }
    }, [push]);

    useEffect(() => { loadSettings(); }, [loadSettings]);

    const saveSettings = async (e) => {
        e.preventDefault();
        setSavingSettings(true);
        try {
            const data = await adminFetch("/admin/loyalty/settings", {
                method: "PUT",
                body: JSON.stringify(settings),
            });
            setSettings(data.settings);
            push("Loyalty settings save ho gayin.", "good");
        } catch (err) {
            push(err.message || "Settings save nahi ho sakin.", "bad");
        } finally {
            setSavingSettings(false);
        }
    };

    // ---- Manual adjustment ----
    const [userQuery, setUserQuery] = useState("");
    const [userResults, setUserResults] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [adjustPoints, setAdjustPoints] = useState("");
    const [adjustNote, setAdjustNote] = useState("");
    const [adjusting, setAdjusting] = useState(false);

    useEffect(() => {
        if (!userQuery.trim()) { setUserResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const data = await adminFetch(`/admin/users?search=${encodeURIComponent(userQuery.trim())}&limit=6`);
                setUserResults(data.users || []);
            } catch {
                setUserResults([]);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [userQuery]);

    const submitAdjustment = async (e) => {
        e.preventDefault();
        if (!selectedUser) return push("Pehle koi user select karein.", "bad");
        const delta = Number(adjustPoints);
        if (!Number.isFinite(delta) || delta === 0) return push("Points ek non-zero number honi chahiye.", "bad");
        if (!adjustNote.trim()) return push("Reason/note likhna zaroori hai.", "bad");

        setAdjusting(true);
        try {
            const data = await adminFetch(`/admin/users/${selectedUser.id}/loyalty/adjust`, {
                method: "POST",
                body: JSON.stringify({ points: delta, note: adjustNote.trim() }),
            });
            push(`Balance update ho gaya: ${data.balance} points.`, "good");
            setSelectedUser((u) => ({ ...u, loyalty_points: data.balance }));
            setAdjustPoints("");
            setAdjustNote("");
            loadTransactions();
        } catch (err) {
            push(err.message || "Adjustment fail ho gayi.", "bad");
        } finally {
            setAdjusting(false);
        }
    };

    // ---- Transactions ----
    const [transactions, setTransactions] = useState([]);
    const [txTotal, setTxTotal] = useState(0);
    const [txPage, setTxPage] = useState(1);
    const [txLoading, setTxLoading] = useState(true);
    const txTotalPages = Math.max(1, Math.ceil(txTotal / PAGE_SIZE));

    const loadTransactions = useCallback(async () => {
        setTxLoading(true);
        try {
            const data = await adminFetch(`/admin/loyalty/transactions?page=${txPage}&limit=${PAGE_SIZE}`);
            setTransactions(data.transactions || []);
            setTxTotal(data.total || 0);
        } catch (err) {
            push(err.message || "Transactions load nahi ho sakin.", "bad");
        } finally {
            setTxLoading(false);
        }
    }, [txPage, push]);

    useEffect(() => { loadTransactions(); }, [loadTransactions]);

    const setField = (key) => (e) => {
        const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setSettings((s) => ({ ...s, [key]: val }));
    };

    return (
        <div>
            <ToastStack toasts={toasts} />

            {/* ---- Settings ---- */}
            <div className="mb-10 border border-[#D1B79E] bg-[#EDE6DA]/40 p-6">
                <div className="mb-5 flex items-center gap-2">
                    <Award size={16} className="text-[#432817]" />
                    <h2 className="font-serif text-lg text-[#432817]">Loyalty Settings</h2>
                </div>

                {settingsLoading || !settings ? (
                    <p className="text-xs text-[#7E7E86]">Loading...</p>
                ) : (
                    <form onSubmit={saveSettings} className="grid gap-5 sm:grid-cols-2">
                        <label className="text-xs text-[#432817]">
                            Earn rate (points per $1 spent)
                            <input
                                type="number" min="0" step="0.1" value={settings.earn_rate}
                                onChange={setField("earn_rate")}
                                className="mt-1 w-full border-0 border-b border-[#D1B79E] bg-transparent py-1.5 outline-none focus:border-[#432817]"
                            />
                        </label>
                        <label className="text-xs text-[#432817]">
                            Redeem rate (points needed for $1 discount)
                            <input
                                type="number" min="0" step="0.1" value={settings.redeem_rate}
                                onChange={setField("redeem_rate")}
                                className="mt-1 w-full border-0 border-b border-[#D1B79E] bg-transparent py-1.5 outline-none focus:border-[#432817]"
                            />
                        </label>
                        <label className="text-xs text-[#432817]">
                            Minimum points to redeem
                            <input
                                type="number" min="0" step="1" value={settings.min_redeem_points}
                                onChange={setField("min_redeem_points")}
                                className="mt-1 w-full border-0 border-b border-[#D1B79E] bg-transparent py-1.5 outline-none focus:border-[#432817]"
                            />
                        </label>
                        <label className="text-xs text-[#432817]">
                            Max % of order redeemable via points
                            <input
                                type="number" min="0" max="100" step="1" value={settings.max_redeem_percent}
                                onChange={setField("max_redeem_percent")}
                                className="mt-1 w-full border-0 border-b border-[#D1B79E] bg-transparent py-1.5 outline-none focus:border-[#432817]"
                            />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-[#432817] sm:col-span-2">
                            <input type="checkbox" checked={!!settings.is_enabled} onChange={setField("is_enabled")} />
                            Loyalty program enabled (site-wide)
                        </label>
                        <button
                            type="submit"
                            disabled={savingSettings}
                            className="flex w-fit items-center gap-2 bg-[#432817] px-5 py-2.5 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720] disabled:opacity-50 sm:col-span-2"
                        >
                            <Save size={13} /> {savingSettings ? "Saving..." : "Save settings"}
                        </button>
                    </form>
                )}
            </div>

            {/* ---- Manual adjustment ---- */}
            <div className="mb-10 border border-[#D1B79E] bg-[#EDE6DA]/40 p-6">
                <h2 className="mb-5 font-serif text-lg text-[#432817]">Manual Points Adjustment</h2>
                <div className="relative mb-4 max-w-md">
                    <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#7E7E86]" />
                    <input
                        type="text"
                        value={userQuery}
                        onChange={(e) => { setUserQuery(e.target.value); setSelectedUser(null); }}
                        placeholder="Search user by name or email"
                        className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 pl-6 pr-6 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                    />
                    {userQuery && (
                        <button type="button" onClick={() => { setUserQuery(""); setSelectedUser(null); }} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#7E7E86]">
                            <X size={13} />
                        </button>
                    )}
                    {userResults.length > 0 && !selectedUser && (
                        <div className="absolute z-10 mt-1 w-full border border-[#D1B79E] bg-[#FAF7F2] shadow-md">
                            {userResults.map((u) => (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => { setSelectedUser(u); setUserQuery(""); setUserResults([]); }}
                                    className="block w-full px-3 py-2 text-left text-xs hover:bg-[#432817]/[0.06]"
                                >
                                    {u.name} <span className="text-[#7E7E86]">({u.email})</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {selectedUser && (
                    <form onSubmit={submitAdjustment} className="max-w-md space-y-4 border-t border-[#D1B79E]/60 pt-4">
                        <p className="text-xs text-[#432817]">
                            {selectedUser.name} ({selectedUser.email}) — current balance:{" "}
                            <strong>{selectedUser.loyalty_points ?? 0} points</strong>
                        </p>
                        <label className="block text-xs text-[#432817]">
                            Points (+ to add, − to deduct)
                            <input
                                type="number" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)}
                                className="mt-1 w-full border-0 border-b border-[#D1B79E] bg-transparent py-1.5 outline-none focus:border-[#432817]"
                            />
                        </label>
                        <label className="block text-xs text-[#432817]">
                            Reason / note
                            <input
                                type="text" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
                                placeholder="e.g. Compensation for delayed order"
                                className="mt-1 w-full border-0 border-b border-[#D1B79E] bg-transparent py-1.5 outline-none focus:border-[#432817]"
                            />
                        </label>
                        <button
                            type="submit" disabled={adjusting}
                            className="bg-[#432817] px-5 py-2.5 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720] disabled:opacity-50"
                        >
                            {adjusting ? "Saving..." : "Apply adjustment"}
                        </button>
                    </form>
                )}
            </div>

            {/* ---- Transactions ---- */}
            <div>
                <h2 className="mb-5 font-serif text-lg text-[#432817]">Points Transactions</h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs">
                        <thead>
                            <tr className="border-b border-[#D1B79E]/60 text-[9px] uppercase tracking-[0.15em] text-[#7E7E86]">
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Points</th>
                                <th className="px-4 py-3">Balance after</th>
                                <th className="px-4 py-3">Order</th>
                                <th className="px-4 py-3">Note</th>
                                <th className="px-4 py-3">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {txLoading ? (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#7E7E86]">Loading...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#7E7E86]">No transactions yet.</td></tr>
                            ) : (
                                transactions.map((tx) => (
                                    <tr key={tx.id} className="border-b border-[#D1B79E]/30 last:border-0">
                                        <td className="px-4 py-3">
                                            <p className="text-[#432817]">{tx.user_name || "Unknown"}</p>
                                            <p className="text-[10px] text-[#7E7E86]">{tx.user_email}</p>
                                        </td>
                                        <td className="px-4 py-3"><TypeTag type={tx.type} /></td>
                                        <td className={`px-4 py-3 font-medium ${tx.points >= 0 ? "text-[#6B7A5E]" : "text-[#9B4635]"}`}>
                                            {tx.points >= 0 ? `+${tx.points}` : tx.points}
                                        </td>
                                        <td className="px-4 py-3">{tx.balance_after}</td>
                                        <td className="px-4 py-3 text-[#7E7E86]">{tx.order_number || "—"}</td>
                                        <td className="px-4 py-3 text-[#7E7E86]">{tx.note || "—"}</td>
                                        <td className="px-4 py-3 text-[#7E7E86]">
                                            {tx.created_at ? new Date(tx.created_at + "Z").toLocaleDateString() : "—"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] text-[#7E7E86]">
                    <span>Page {txPage} of {txTotalPages} · {txTotal} record{txTotal === 1 ? "" : "s"}</span>
                    <div className="flex gap-3">
                        <button type="button" disabled={txPage <= 1} onClick={() => setTxPage((p) => Math.max(1, p - 1))} className="uppercase tracking-wide hover:text-[#432817] disabled:opacity-30">Prev</button>
                        <button type="button" disabled={txPage >= txTotalPages} onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))} className="uppercase tracking-wide hover:text-[#432817] disabled:opacity-30">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}