import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X, Pencil, Trash2, Tag, ChevronLeft, ChevronRight, UploadCloud } from "lucide-react";

// Deployed Deals worker URL
const API_BASE_URL = "https://deals-worker-service.adeebibrahim01.workers.dev";
const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;
const MULTISELECT_DEBOUNCE_MS = 250;

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

// Same Cloudinary upload pattern as AdminProducts — unsigned upload preset,
// folder passed in per call site.
async function uploadImageToCloudinary(file, folder) {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary configure nahi hai — .env mein VITE_CLOUDINARY_CLOUD_NAME aur VITE_CLOUDINARY_UPLOAD_PRESET set karein.");
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    if (folder) formData.append("folder", folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || "Image upload failed.");
    }
    return data.secure_url;
}

const CLOUDINARY_FOLDERS = {
    deal: "Home/Deals",
};

function dealLabel(value, type) {
    const num = Number(value);
    return type === "%" ? `${num}% OFF` : `$${num} OFF`;
}

// ─────────────────────────────────────────────────────────────
// Toasts + confirm popover (same pattern as AdminDashboard)
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

function ConfirmPopover({ request, onConfirm, onCancel }) {
    if (!request) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#432817]/25 px-4" onClick={onCancel}>
            <div className="w-full max-w-sm border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6" onClick={(e) => e.stopPropagation()}>
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
// API-backed multiselect — shared shape for Product / Category / Brand
// ─────────────────────────────────────────────────────────────

const APPLY_TO_CONFIG = {
    product: { endpoint: "products", label: "product", placeholder: "Search products" },
    category: { endpoint: "categories", label: "category", placeholder: "Search categories" },
    brand: { endpoint: "brands", label: "brand", placeholder: "Search brands" },
};

function ItemMultiSelect({ applyTo, selectedItems, onChange }) {
    const config = APPLY_TO_CONFIG[applyTo];
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await adminFetch(
                    `/admin/deals/search/${config.endpoint}?search=${encodeURIComponent(query.trim())}`
                );
                setResults(res[config.endpoint] || []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, MULTISELECT_DEBOUNCE_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, applyTo]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const addItem = (item) => {
        if (selectedItems.some((s) => s.id === item.id)) return; // no duplicates
        onChange([...selectedItems, item]);
        setQuery("");
        setOpen(false);
    };

    const removeItem = (id) => {
        onChange(selectedItems.filter((s) => s.id !== id));
    };

    return (
        <div ref={containerRef} className="relative">
            <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                {config.label}s
            </label>

            <div className="relative">
                <Search size={13} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#7E7E86]" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setOpen(true)}
                    placeholder={config.placeholder}
                    className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 pl-6 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                />
            </div>

            {open && (
                <div className="absolute z-20 mt-1 w-full border border-[#D1B79E] bg-[#EDE6DA] shadow-[0_4px_20px_rgba(67,40,23,0.12)]">
                    {loading ? (
                        <div className="px-4 py-3 text-[11px] text-[#7E7E86]">Searching…</div>
                    ) : results.length === 0 ? (
                        <div className="px-4 py-3 text-[11px] text-[#7E7E86]">No {config.label}s found.</div>
                    ) : (
                        results.map((item) => {
                            const alreadySelected = selectedItems.some((s) => s.id === item.id);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    disabled={alreadySelected}
                                    onClick={() => addItem(item)}
                                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs transition-colors hover:bg-[#432817]/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <span className="truncate text-[#432817]">{item.name}</span>
                                    {alreadySelected && <span className="text-[9px] uppercase tracking-[0.1em] text-[#7E7E86]">Added</span>}
                                </button>
                            );
                        })
                    )}
                </div>
            )}

            {selectedItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {selectedItems.map((item) => (
                        <span
                            key={item.id}
                            className="inline-flex items-center gap-1.5 border border-[#D1B79E] bg-[#432817]/[0.03] px-3 py-1.5 text-[11px] text-[#432817]"
                        >
                            {item.name}
                            <button type="button" onClick={() => removeItem(item.id)} className="text-[#7E7E86] hover:text-[#9B4635]">
                                <X size={11} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Create / edit deal modal
// ─────────────────────────────────────────────────────────────

const emptyForm = {
    name: "",
    image: "",
    value: "",
    type: "%",
    apply_to: "product",
    status: "active",
};

function DealFormModal({ deal, onClose, onSaved, push }) {
    const isEdit = Boolean(deal);
    const [form, setForm] = useState(emptyForm);
    const [selectedItems, setSelectedItems] = useState([]);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isDraggingImage, setIsDraggingImage] = useState(false);

    useEffect(() => {
        if (deal) {
            setForm({
                name: deal.name || "",
                image: deal.image || "",
                value: deal.value ?? "",
                type: deal.type || "%",
                apply_to: deal.apply_to || "product",
                status: deal.status || "active",
            });
            setSelectedItems(deal.items || []);
        } else {
            setForm(emptyForm);
            setSelectedItems([]);
        }
    }, [deal]);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleApplyToChange = (value) => {
        setField("apply_to", value);
        setSelectedItems([]); // switching target clears the previous selection
    };

    // Shared upload logic for the deal image — used by both the file
    // picker (onChange) and drag & drop (onDrop), same as AdminProducts.
    const processImageFile = async (file) => {
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadImageToCloudinary(file, CLOUDINARY_FOLDERS.deal);
            setField("image", url);
        } catch (err) {
            push(err.message || "Image upload failed.", "bad");
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        // Reset the native input value so selecting the exact same file
        // again later (e.g. after removing it) still fires onChange.
        e.target.value = "";
        await processImageFile(file);
    };

    const handleImageDrop = async (e) => {
        e.preventDefault();
        setIsDraggingImage(false);
        if (uploading) return;
        await processImageFile(e.dataTransfer.files?.[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return push("Deal name is required.", "bad");
        if (form.value === "" || isNaN(Number(form.value))) return push("Deal value must be a number.", "bad");
        if (selectedItems.length === 0) return push(`Select at least one ${form.apply_to}.`, "bad");

        const idKey = form.apply_to === "product" ? "product_ids" : form.apply_to === "category" ? "category_ids" : "brand_ids";
        const payload = {
            name: form.name.trim(),
            image: form.image.trim() || null,
            value: Number(form.value),
            type: form.type,
            apply_to: form.apply_to,
            status: form.status,
            [idKey]: selectedItems.map((i) => i.id),
        };

        setSaving(true);
        try {
            if (isEdit) {
                await adminFetch(`/admin/deals/${deal.id}`, { method: "PATCH", body: JSON.stringify(payload) });
                push("Deal updated.", "good");
            } else {
                await adminFetch("/admin/deals", { method: "POST", body: JSON.stringify(payload) });
                push("Deal created.", "good");
            }
            onSaved();
        } catch (err) {
            push(err.message || "Could not save the deal.", "bad");
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
                    <p className="font-serif text-lg leading-snug text-[#432817]">{isEdit ? "Edit deal" : "New deal"}</p>
                    <button type="button" onClick={onClose} className="text-[#7E7E86] hover:text-[#432817]">
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-5 space-y-5">
                    <div>
                        <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Deal name
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setField("name", e.target.value)}
                            placeholder="Summer Sale"
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Deal image
                        </label>
                        <label
                            className={`flex cursor-pointer items-center gap-2 border border-dashed px-4 py-3 text-xs transition-colors ${isDraggingImage
                                    ? "border-[#432817] bg-[#432817]/5 text-[#432817]"
                                    : "border-[#D1B79E] text-[#7E7E86] hover:border-[#432817] hover:text-[#432817]"
                                }`}
                            onDragOver={(e) => { e.preventDefault(); if (!uploading) setIsDraggingImage(true); }}
                            onDragLeave={() => setIsDraggingImage(false)}
                            onDrop={handleImageDrop}
                        >
                            <UploadCloud size={14} />
                            {uploading ? "Uploading…" : "Click to upload, or drag & drop an image"}
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
                        </label>

                        {uploading ? (
                            <div className="mt-2 h-16 w-16 animate-pulse rounded-sm bg-[#D1B79E]/40" />
                        ) : form.image ? (
                            <div className="mt-2 flex items-center gap-2">
                                <img src={form.image} alt="Preview" className="h-16 w-16 rounded-sm object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setField("image", "")}
                                    className="text-[10px] text-[#9B4635] underline"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : null}
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
                                placeholder="5"
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
                        Preview: <span className="font-medium">{form.value !== "" ? dealLabel(form.value, form.type) : "—"}</span>
                    </p>

                    <div>
                        <label className="mb-1.5 block text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Apply deal to
                        </label>
                        <select
                            value={form.apply_to}
                            onChange={(e) => handleApplyToChange(e.target.value)}
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                        >
                            <option value="product">Product</option>
                            <option value="category">Category</option>
                            <option value="brand">Brand</option>
                        </select>
                    </div>

                    <ItemMultiSelect applyTo={form.apply_to} selectedItems={selectedItems} onChange={setSelectedItems} />

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
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <div className="mt-7 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase hover:text-[#432817]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving || uploading}
                        className="bg-[#432817] px-5 py-2 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720] disabled:opacity-50"
                    >
                        {saving ? "Saving…" : isEdit ? "Save changes" : "Create deal"}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export default function AdminDeals() {
    const { toasts, push } = useToasts();

    const [deals, setDeals] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const [formModal, setFormModal] = useState(null); // null | "new" | dealObject
    const [confirmRequest, setConfirmRequest] = useState(null);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchInput]);

    const loadDeals = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");
        try {
            const res = await adminFetch(`/admin/deals?page=${page}&limit=${PAGE_SIZE}&search=${encodeURIComponent(search)}`);
            setDeals(res.deals);
            setTotal(res.total);
        } catch (err) {
            setErrorMessage(err.message || "Could not reach the deals ledger. Try again in a moment.");
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        loadDeals();
    }, [loadDeals]);

    const requestDelete = (deal) => {
        setConfirmRequest({
            title: "Delete this deal?",
            description: `"${deal.name}" will stop applying immediately. This can't be undone.`,
            confirmLabel: "Delete",
            action: async () => {
                try {
                    await adminFetch(`/admin/deals/${deal.id}`, { method: "DELETE" });
                    push(`"${deal.name}" deleted.`, "good");
                    loadDeals();
                } catch (err) {
                    push(err.message || "Could not delete the deal.", "bad");
                }
            },
        });
    };

    const handleConfirm = () => {
        const action = confirmRequest?.action;
        setConfirmRequest(null);
        action?.();
    };

    const itemsSummary = (deal) => {
        if (!deal.items || deal.items.length === 0) return "—";
        const names = deal.items.slice(0, 2).map((i) => i.name).join(", ");
        const extra = deal.items.length > 2 ? ` +${deal.items.length - 2} more` : "";
        return `${names}${extra}`;
    };

    return (
        <div>
            <ToastStack toasts={toasts} />
            <ConfirmPopover request={confirmRequest} onConfirm={handleConfirm} onCancel={() => setConfirmRequest(null)} />
            {formModal && (
                <DealFormModal
                    deal={formModal === "new" ? null : formModal}
                    onClose={() => setFormModal(null)}
                    onSaved={() => {
                        setFormModal(null);
                        loadDeals();
                    }}
                    push={push}
                />
            )}

            {/* Search + new deal */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="relative max-w-md flex-1">
                    <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#7E7E86]" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search deals by name"
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
                <button
                    type="button"
                    onClick={() => setFormModal("new")}
                    className="flex items-center gap-2 bg-[#432817] px-5 py-2.5 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720]"
                >
                    <Plus size={13} /> New deal
                </button>
            </div>

            {errorMessage && (
                <div className="mb-5 border-l-2 border-[#9B4635] bg-[#9B4635]/5 px-4 py-3 text-xs text-[#7a3226]">
                    {errorMessage}
                </div>
            )}

            {/* Deals table */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs">
                    <thead>
                        <tr className="border-b border-[#D1B79E]/60 text-[9px] uppercase tracking-[0.15em] text-[#7E7E86]">
                            <th className="px-4 py-3">Deal</th>
                            <th className="px-4 py-3">Discount</th>
                            <th className="px-4 py-3">Applies to</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
                        ) : deals.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-14 text-center">
                                    <p className="font-serif text-lg text-[#432817]">No deals match that search.</p>
                                    <p className="mt-1 text-[11px] text-[#7E7E86]">
                                        Try a different name, or{" "}
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
                            deals.map((deal) => (
                                <tr
                                    key={deal.id}
                                    className="border-b border-[#D1B79E]/30 transition-colors last:border-0 hover:bg-[#432817]/[0.03]"
                                >
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-3">
                                            {deal.image ? (
                                                <img src={deal.image} alt={deal.name} className="h-10 w-10 shrink-0 rounded-sm object-cover" />
                                            ) : (
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#D1B79E]/40">
                                                    <Tag size={14} className="text-[#7E7E86]" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-[#432817]">{deal.name}</p>
                                                <p className="truncate text-[10px] text-[#7E7E86]">{itemsSummary(deal)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 font-medium text-[#432817]">{deal.label || dealLabel(deal.value, deal.type)}</td>
                                    <td className="px-4 py-3.5 text-[#7E7E86] capitalize">{deal.apply_to}</td>
                                    <td className="px-4 py-3.5">
                                        <span
                                            className="inline-flex items-center text-[11px] capitalize text-[#432817]"
                                        >
                                            <span
                                                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                                                style={{ backgroundColor: deal.status === "active" ? "#6B7A5E" : "#7E7E86" }}
                                            />
                                            {deal.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex justify-end gap-3 text-[10px] font-medium tracking-[0.08em] uppercase">
                                            <button
                                                type="button"
                                                onClick={() => setFormModal(deal)}
                                                className="flex items-center gap-1 text-[#432817] underline decoration-[#D1B79E] underline-offset-3 hover:decoration-[#432817]"
                                            >
                                                <Pencil size={11} /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => requestDelete(deal)}
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
                    Page {page} of {totalPages} · {total} deal{total === 1 ? "" : "s"}
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