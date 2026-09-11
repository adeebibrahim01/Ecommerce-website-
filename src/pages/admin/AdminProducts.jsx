import { useCallback, useEffect, useState } from "react";
import { Search, X, Plus, Pencil, Trash2, Package } from "lucide-react";

const API_BASE_URL = "https://product-worker-service.adeebibrahim01.workers.dev";
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 350;

async function productFetch(path, options = {}) {
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

const CATEGORIES = ["Men", "Women", "Accessories"];
const FILTER_CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Clothing", "Accessories"];
const BADGES = ["", "New", "Bestseller", "Sale"];
const STATUSES = ["active", "draft", "archived"];
const COLLECTIONS = [
    { value: "", label: "All collections" },
    { value: "new-in", label: "New In" },
    { value: "sale", label: "Sale" },
    { value: "featured", label: "Featured" },
    { value: "bestseller", label: "Bestseller" },
];

function money(n) {
    const num = Number(n);
    return Number.isFinite(num) ? `$${num.toFixed(2)}` : "—";
}

const EMPTY_PRODUCT = {
    name: "",
    price: "",
    sale_price: "",
    image: "",
    category: "Men",
    filter_category: "",
    type: "",
    badge: "",
    is_new_in: false,
    is_on_sale: false,
    featured: false,
    status: "active",
};

// ─────────────────────────────────────────────────────────────
// Toasts (self-contained so this component drops in standalone)
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

// ─────────────────────────────────────────────────────────────
// Delete confirm popover
// ─────────────────────────────────────────────────────────────

function ConfirmPopover({ product, onConfirm, onCancel }) {
    if (!product) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#432817]/25 px-4" onClick={onCancel}>
            <div
                className="w-full max-w-sm border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="font-serif text-lg leading-snug text-[#432817]">Delete this product?</p>
                <p className="mt-2 text-xs leading-5 text-[#7E7E86]">
                    {product.name} will be permanently removed from the catalog. This can't be undone.
                </p>
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
                        className="bg-[#9B4635] px-5 py-2 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#7a3226]"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Create / Edit form popover
// ─────────────────────────────────────────────────────────────

function ProductFormPopover({ mode, initialData, onSave, onClose, saving }) {
    const [form, setForm] = useState(initialData || EMPTY_PRODUCT);
    const [error, setError] = useState("");

    useEffect(() => {
        setForm(initialData || EMPTY_PRODUCT);
        setError("");
    }, [initialData]);

    if (!mode) return null;

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.price || !form.image.trim() || !form.category) {
            setError("Name, price, image aur category zaroori hain.");
            return;
        }
        setError("");
        onSave(form);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#432817]/25 px-4" onClick={onClose}>
            <form
                onSubmit={handleSubmit}
                className="max-h-[88vh] w-full max-w-lg overflow-y-auto border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <p className="font-serif text-lg text-[#432817]">
                        {mode === "create" ? "Add a new product" : "Edit product"}
                    </p>
                    <button type="button" onClick={onClose} className="text-[#7E7E86] hover:text-[#432817]">
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    <div>
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Name
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => update("name", e.target.value)}
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Price
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.price}
                                onChange={(e) => update("price", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Sale price (optional)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.sale_price}
                                onChange={(e) => update("sale_price", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Image URL
                        </label>
                        <input
                            type="text"
                            value={form.image}
                            onChange={(e) => update("image", e.target.value)}
                            placeholder="https://..."
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                        />
                        {form.image && (
                            <img
                                src={form.image}
                                alt="Preview"
                                className="mt-2 h-24 w-24 rounded-sm object-cover"
                                onError={(e) => (e.target.style.display = "none")}
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Category
                            </label>
                            <select
                                value={form.category}
                                onChange={(e) => update("category", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Sub-category
                            </label>
                            <select
                                value={form.filter_category || ""}
                                onChange={(e) => update("filter_category", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            >
                                <option value="">—</option>
                                {FILTER_CATEGORIES.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Type
                            </label>
                            <input
                                type="text"
                                value={form.type || ""}
                                onChange={(e) => update("type", e.target.value)}
                                placeholder="Shirts, Shoes..."
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Badge
                            </label>
                            <select
                                value={form.badge || ""}
                                onChange={(e) => update("badge", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            >
                                {BADGES.map((b) => (
                                    <option key={b || "none"} value={b}>{b || "None"}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Status
                            </label>
                            <select
                                value={form.status || "active"}
                                onChange={(e) => update("status", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            >
                                {STATUSES.map((s) => (
                                    <option key={s} value={s} className="capitalize">{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-5 pt-1">
                        <label className="flex items-center gap-2 text-xs text-[#432817]">
                            <input
                                type="checkbox"
                                checked={!!form.is_new_in}
                                onChange={(e) => update("is_new_in", e.target.checked)}
                            />
                            New In
                        </label>
                        <label className="flex items-center gap-2 text-xs text-[#432817]">
                            <input
                                type="checkbox"
                                checked={!!form.is_on_sale}
                                onChange={(e) => update("is_on_sale", e.target.checked)}
                            />
                            On sale
                        </label>
                        <label className="flex items-center gap-2 text-xs text-[#432817]">
                            <input
                                type="checkbox"
                                checked={!!form.featured}
                                onChange={(e) => update("featured", e.target.checked)}
                            />
                            Featured
                        </label>
                    </div>

                    {error && <p className="text-xs text-[#9B4635]">{error}</p>}

                    <button
                        type="submit"
                        disabled={saving}
                        className="mt-2 w-full bg-[#432817] py-3 text-[10px] font-medium tracking-[0.2em] text-[#EDE6DA] uppercase hover:bg-[#5a3720] disabled:opacity-50"
                    >
                        {saving ? "Saving…" : mode === "create" ? "Add product" : "Save changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export default function AdminProducts() {
    const { toasts, push } = useToasts();

    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [collectionFilter, setCollectionFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [formMode, setFormMode] = useState(null); // null | "create" | "edit"
    const [editingProduct, setEditingProduct] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [searchInput]);

    const loadProducts = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(PAGE_SIZE),
                search,
            });
            if (categoryFilter) params.set("category", categoryFilter);
            if (collectionFilter) params.set("collection", collectionFilter);
            if (statusFilter) params.set("status", statusFilter);

            const res = await productFetch(`/admin/products?${params.toString()}`);
            setProducts(res.products);
            setTotal(res.total);
        } catch (err) {
            setErrorMessage(err.message || "Could not reach the catalog. Try again in a moment.");
        } finally {
            setLoading(false);
        }
    }, [page, search, categoryFilter, collectionFilter, statusFilter]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const openCreate = () => {
        setEditingProduct(null);
        setFormMode("create");
    };

    const openEdit = (product) => {
        setEditingProduct({
            ...product,
            sale_price: product.sale_price ?? "",
            is_new_in: !!product.is_new_in,
            is_on_sale: !!product.is_on_sale,
            featured: !!product.featured,
        });
        setFormMode("edit");
    };

    const closeForm = () => {
        setFormMode(null);
        setEditingProduct(null);
    };

    const handleSave = async (form) => {
        setSaving(true);
        const payload = {
            ...form,
            price: Number(form.price),
            sale_price: form.sale_price === "" ? null : Number(form.sale_price),
            is_new_in: form.is_new_in ? 1 : 0,
            is_on_sale: form.is_on_sale ? 1 : 0,
            featured: form.featured ? 1 : 0,
        };

        try {
            if (formMode === "create") {
                await productFetch("/admin/products", { method: "POST", body: JSON.stringify(payload) });
                push(`${form.name} added to the catalog.`, "good");
            } else {
                await productFetch(`/admin/products/${editingProduct.id}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });
                push(`${form.name} updated.`, "good");
            }
            closeForm();
            loadProducts();
        } catch (err) {
            push(err.message || "Could not save product.", "bad");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const product = deleteTarget;
        setDeleteTarget(null);
        try {
            await productFetch(`/admin/products/${product.id}`, { method: "DELETE" });
            push(`${product.name} deleted.`, "bad");
            loadProducts();
        } catch (err) {
            push(err.message || "Could not delete product.", "bad");
        }
    };

    return (
        <div>
            <ToastStack toasts={toasts} />
            <ProductFormPopover
                mode={formMode}
                initialData={editingProduct}
                onSave={handleSave}
                onClose={closeForm}
                saving={saving}
            />
            <ConfirmPopover product={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

            {/* Filters row */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="relative max-w-xs flex-1">
                    <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-[#7E7E86]" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search products"
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

                <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                    className="border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                >
                    <option value="">All categories</option>
                    {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                <select
                    value={collectionFilter}
                    onChange={(e) => { setCollectionFilter(e.target.value); setPage(1); }}
                    className="border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                >
                    {COLLECTIONS.map((c) => (
                        <option key={c.value || "all"} value={c.value}>{c.label}</option>
                    ))}
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs capitalize outline-none focus:border-[#432817]"
                >
                    <option value="">All statuses</option>
                    {STATUSES.map((s) => (
                        <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={openCreate}
                    className="ml-auto flex items-center gap-2 bg-[#432817] px-4 py-2 text-[9px] font-medium tracking-[0.18em] text-[#EDE6DA] uppercase hover:bg-[#5a3720]"
                >
                    <Plus size={13} /> Add product
                </button>
            </div>

            {errorMessage && (
                <div className="mb-5 border-l-2 border-[#9B4635] bg-[#9B4635]/5 px-4 py-3 text-xs text-[#7a3226]">
                    {errorMessage}
                </div>
            )}

            {/* Products grid */}
            {loading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-64 animate-pulse rounded-sm bg-[#D1B79E]/30" />
                    ))}
                </div>
            ) : products.length === 0 ? (
                <div className="py-14 text-center">
                    <p className="font-serif text-lg text-[#432817]">No products match those filters.</p>
                    <p className="mt-1 text-[11px] text-[#7E7E86]">Try clearing a filter, or add a new product.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {products.map((p) => (
                        <div key={p.id} className="group relative border border-[#D1B79E]/60 bg-white/40">
                            <div className="relative aspect-[3/4] overflow-hidden bg-[#D1B79E]/20">
                                {p.image ? (
                                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        <Package size={20} className="text-[#7E7E86]" />
                                    </div>
                                )}
                                {p.badge && (
                                    <span className="absolute left-2 top-2 bg-[#432817] px-2 py-1 text-[8px] font-medium tracking-[0.1em] text-[#EDE6DA] uppercase">
                                        {p.badge}
                                    </span>
                                )}
                                {p.status !== "active" && (
                                    <span className="absolute right-2 top-2 bg-[#7E7E86] px-2 py-1 text-[8px] font-medium tracking-[0.1em] text-[#EDE6DA] uppercase capitalize">
                                        {p.status}
                                    </span>
                                )}
                                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={() => openEdit(p)}
                                        className="rounded-full bg-white/90 p-1.5 text-[#432817] hover:bg-white"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteTarget(p)}
                                        className="rounded-full bg-white/90 p-1.5 text-[#9B4635] hover:bg-white"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-3">
                                <p className="truncate text-xs font-medium text-[#432817]">{p.name}</p>
                                <p className="mt-0.5 text-[10px] text-[#7E7E86]">{p.category} · {p.filter_category || "—"}</p>
                                <div className="mt-1.5 flex items-baseline gap-2">
                                    {p.sale_price ? (
                                        <>
                                            <span className="text-xs font-medium text-[#9B4635]">{money(p.sale_price)}</span>
                                            <span className="text-[10px] text-[#7E7E86] line-through">{money(p.price)}</span>
                                        </>
                                    ) : (
                                        <span className="text-xs font-medium text-[#432817]">{money(p.price)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between text-[11px] text-[#7E7E86]">
                <span>
                    Page {page} of {totalPages} · {total} product{total === 1 ? "" : "s"}
                </span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 uppercase tracking-wide hover:text-[#432817] disabled:opacity-30"
                    >
                        Prev
                    </button>
                    <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="px-3 py-1.5 uppercase tracking-wide hover:text-[#432817] disabled:opacity-30"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}