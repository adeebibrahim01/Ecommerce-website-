import { useCallback, useEffect, useState } from "react";
import { Search, X, Plus, Pencil, Trash2, Package, Tag, UploadCloud } from "lucide-react";

const API_BASE_URL = "https://product-worker-service.adeebibrahim01.workers.dev";
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 350;
const DESCRIPTION_MAX_LENGTH = 300;

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

// folder: "Home/Products" ya "Home/Brands" — jahan se call ho wahi decide karta hai
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
    product: "Home/Products",
    brand: "Home/Brands",
};

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
    description: "",
    price: "",
    sale_price: "",
    image: "",
    category_id: "",
    brand_id: "",
    filter_category: "",
    type: "",
    badge: "",
    is_new_in: false,
    is_on_sale: false,
    featured: false,
    status: "active",
};

// ─────────────────────────────────────────────────────────────
// Toasts
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
                    className="min-w-[220px] max-w-xs border-l-2 bg-[#EDE6DA] px-4 py-3 text-xs text-[#432817] shadow-[0_4px_20px_rgba(67,40,23,0.12)] animate-[fadeIn_0.2s_ease-out]"
                    style={{ borderColor: borderColor[t.tone] || borderColor.neutral }}
                >
                    {t.message}
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Skeletons
// ─────────────────────────────────────────────────────────────

function ProductCardSkeleton() {
    return (
        <div className="border border-[#D1B79E]/60 bg-white/40">
            <div className="aspect-[3/4] animate-pulse bg-[#D1B79E]/30" />
            <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 animate-pulse rounded-sm bg-[#D1B79E]/40" />
                <div className="h-2.5 w-1/2 animate-pulse rounded-sm bg-[#D1B79E]/25" />
                <div className="h-2.5 w-full animate-pulse rounded-sm bg-[#D1B79E]/20" />
                <div className="h-3 w-1/3 animate-pulse rounded-sm bg-[#D1B79E]/40" />
            </div>
        </div>
    );
}

function TaxonomyRowSkeleton() {
    return (
        <div className="flex items-center gap-2.5 py-2.5">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-sm bg-[#D1B79E]/30" />
            <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/2 animate-pulse rounded-sm bg-[#D1B79E]/40" />
                <div className="h-2 w-1/4 animate-pulse rounded-sm bg-[#D1B79E]/25" />
            </div>
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
            <div className="w-full max-w-sm border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6" onClick={(e) => e.stopPropagation()}>
                <p className="font-serif text-lg leading-snug text-[#432817]">Delete this product?</p>
                <p className="mt-2 text-xs leading-5 text-[#7E7E86]">
                    {product.name} will be permanently removed from the catalog. This can't be undone.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-[10px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase hover:text-[#432817]">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm} className="bg-[#9B4635] px-5 py-2 text-[10px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#7a3226]">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Categories / Brands manager popover
// ─────────────────────────────────────────────────────────────

function TaxonomyPopover({ kind, onClose, onChanged, push }) {
    const isCategory = kind === "category";
    const basePath = isCategory ? "/admin/categories" : "/admin/brands";
    const label = isCategory ? "Category" : "Brand";

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [newImage, setNewImage] = useState("");
    const [uploadingNew, setUploadingNew] = useState(false);
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState("");
    const [logoUploadingId, setLogoUploadingId] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await productFetch(basePath);
            setItems(isCategory ? res.categories : res.brands);
        } catch (err) {
            push(err.message || `Could not load ${label.toLowerCase()}s.`, "bad");
        } finally {
            setLoading(false);
        }
    }, [basePath, isCategory, label, push]);

    useEffect(() => { load(); }, [load]);

    const handleNewImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingNew(true);
        try {
            const url = await uploadImageToCloudinary(file, CLOUDINARY_FOLDERS.brand);
            setNewImage(url);
        } catch (err) {
            push(err.message || "Image upload failed.", "bad");
        } finally {
            setUploadingNew(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setAdding(true);
        try {
            const payload = isCategory
                ? { name: newName.trim() }
                : { name: newName.trim(), logo: newImage || null };
            await productFetch(basePath, { method: "POST", body: JSON.stringify(payload) });
            setNewName("");
            setNewImage("");
            push(`${label} added.`, "good");
            await load();
            onChanged();
        } catch (err) {
            push(err.message || `Could not add ${label.toLowerCase()}.`, "bad");
        } finally {
            setAdding(false);
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setEditingName(item.name);
    };

    const saveEdit = async (id) => {
        if (!editingName.trim()) return;
        try {
            await productFetch(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify({ name: editingName.trim() }) });
            setEditingId(null);
            push(`${label} updated.`, "good");
            await load();
            onChanged();
        } catch (err) {
            push(err.message || `Could not update ${label.toLowerCase()}.`, "bad");
        }
    };

    const handleLogoChange = async (item, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoUploadingId(item.id);
        try {
            const url = await uploadImageToCloudinary(file, CLOUDINARY_FOLDERS.brand);
            await productFetch(`${basePath}/${item.id}`, {
                method: "PATCH",
                body: JSON.stringify({ name: item.name, logo: url }),
            });
            push("Logo updated.", "good");
            await load();
            onChanged();
        } catch (err) {
            push(err.message || "Logo update failed.", "bad");
        } finally {
            setLogoUploadingId(null);
        }
    };

    const confirmDelete = async () => {
        const target = deleteTarget;
        setDeleteTarget(null);
        try {
            await productFetch(`${basePath}/${target.id}`, { method: "DELETE" });
            push(`${label} deleted.`, "bad");
            await load();
            onChanged();
        } catch (err) {
            push(err.message || `Could not delete ${label.toLowerCase()}.`, "bad");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#432817]/25 px-4" onClick={onClose}>
            <div className="max-h-[80vh] w-full max-w-md overflow-y-auto border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <p className="font-serif text-lg text-[#432817]">Manage {label}s</p>
                    <button type="button" onClick={onClose} className="text-[#7E7E86] hover:text-[#432817]">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleAdd} className="mt-4 space-y-3">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder={`New ${label.toLowerCase()} name`}
                            className="flex-1 border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                        />
                        <button
                            type="submit"
                            disabled={adding || uploadingNew || !newName.trim()}
                            className="flex items-center gap-1 bg-[#432817] px-3 py-2 text-[9px] font-medium tracking-[0.15em] text-[#EDE6DA] uppercase hover:bg-[#5a3720] disabled:opacity-50"
                        >
                            <Plus size={12} /> Add
                        </button>
                    </div>

                    {!isCategory && (
                        <div className="flex items-center gap-3">
                            <label className="flex cursor-pointer items-center gap-2 border border-dashed border-[#D1B79E] px-3 py-2 text-[10px] text-[#7E7E86] hover:border-[#432817] hover:text-[#432817]">
                                <UploadCloud size={12} />
                                {uploadingNew ? "Uploading…" : "Upload logo (optional)"}
                                <input type="file" accept="image/*" className="hidden" onChange={handleNewImageChange} disabled={uploadingNew} />
                            </label>
                            {newImage && (
                                <div className="flex items-center gap-2">
                                    <img src={newImage} alt="" className="h-8 w-8 rounded-sm object-cover" />
                                    <button type="button" onClick={() => setNewImage("")} className="text-[10px] text-[#9B4635] underline">
                                        Remove
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </form>

                <div className="mt-5 divide-y divide-[#D1B79E]/40">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => <TaxonomyRowSkeleton key={i} />)
                    ) : items.length === 0 ? (
                        <p className="py-4 text-xs text-[#7E7E86]">No {label.toLowerCase()}s yet.</p>
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 py-2.5">
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                    {!isCategory && (
                                        <label className="relative shrink-0 cursor-pointer">
                                            {item.logo ? (
                                                <img src={item.logo} alt="" className="h-8 w-8 rounded-sm object-cover" />
                                            ) : (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#D1B79E]/30">
                                                    <UploadCloud size={12} className="text-[#7E7E86]" />
                                                </div>
                                            )}
                                            {logoUploadingId === item.id && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[7px] text-white">…</div>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleLogoChange(item, e)}
                                                disabled={logoUploadingId === item.id}
                                            />
                                        </label>
                                    )}
                                    {editingId === item.id ? (
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && saveEdit(item.id)}
                                            autoFocus
                                            className="flex-1 border-0 border-b border-[#432817] bg-transparent py-1 text-xs outline-none"
                                        />
                                    ) : (
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs text-[#432817]">{item.name}</p>
                                            {typeof item.product_count === "number" && (
                                                <p className="text-[10px] text-[#7E7E86]">
                                                    {item.product_count} product{item.product_count === 1 ? "" : "s"}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {editingId === item.id ? (
                                        <button type="button" onClick={() => saveEdit(item.id)} className="text-[10px] font-medium text-[#432817] underline">
                                            Save
                                        </button>
                                    ) : (
                                        <button type="button" onClick={() => startEdit(item)} className="text-[#7E7E86] hover:text-[#432817]">
                                            <Pencil size={12} />
                                        </button>
                                    )}
                                    <button type="button" onClick={() => setDeleteTarget(item)} className="text-[#9B4635] hover:text-[#7a3226]">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {deleteTarget && (
                    <div className="mt-4 border-l-2 border-[#9B4635] bg-[#9B4635]/5 px-3 py-2.5 text-xs text-[#7a3226]">
                        Delete "{deleteTarget.name}"?
                        <div className="mt-2 flex gap-3">
                            <button type="button" onClick={confirmDelete} className="font-medium underline">Yes, delete</button>
                            <button type="button" onClick={() => setDeleteTarget(null)} className="text-[#7E7E86] underline">Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Create / Edit form popover
// ─────────────────────────────────────────────────────────────

function ProductFormPopover({ mode, initialData, categories, brands, onSave, onClose, saving }) {
    const [form, setForm] = useState(initialData || EMPTY_PRODUCT);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        setForm(initialData || EMPTY_PRODUCT);
        setError("");
    }, [initialData]);

    if (!mode) return null;

    const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        setError("");
        try {
            const url = await uploadImageToCloudinary(file, CLOUDINARY_FOLDERS.product);
            update("image", url);
        } catch (err) {
            setError(err.message || "Image upload failed.");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.price || !form.image.trim() || !form.category_id) {
            setError("Name, price, image aur category zaroori hain.");
            return;
        }
        setError("");
        onSave(form);
    };

    const descriptionLength = (form.description || "").length;

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
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => update("name", e.target.value)}
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                        />
                    </div>

                    <div>
                        <div className="mb-1 flex items-center justify-between">
                            <label className="block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Description
                            </label>
                            <span className={`text-[9px] ${descriptionLength >= DESCRIPTION_MAX_LENGTH ? "text-[#9B4635]" : "text-[#a89b8c]"}`}>
                                {descriptionLength}/{DESCRIPTION_MAX_LENGTH}
                            </span>
                        </div>
                        <textarea
                            value={form.description || ""}
                            onChange={(e) => update("description", e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
                            rows={3}
                            placeholder="Fabric, fit, styling notes…"
                            className="w-full resize-none border border-[#D1B79E] bg-transparent px-3 py-2 text-xs leading-relaxed outline-none focus:border-[#432817]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">Price</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.price}
                                onChange={(e) => update("price", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">Sale price (optional)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.sale_price}
                                onChange={(e) => update("sale_price", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />
                        </div>
                    </div>

                    {/* Image upload */}
                    <div>
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Product image
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 border border-dashed border-[#D1B79E] px-4 py-3 text-xs text-[#7E7E86] hover:border-[#432817] hover:text-[#432817]">
                            <UploadCloud size={14} />
                            {uploading ? "Uploading…" : "Click to upload an image"}
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
                        </label>

                        {uploading ? (
                            <div className="mt-2 h-16 w-16 animate-pulse rounded-sm bg-[#D1B79E]/40" />
                        ) : form.image ? (
                            <div className="mt-2 flex items-center gap-2">
                                <img src={form.image} alt="Preview" className="h-16 w-16 rounded-sm object-cover" />
                                <button
                                    type="button"
                                    onClick={() => update("image", "")}
                                    className="text-[10px] text-[#9B4635] underline"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">Category</label>
                            <select
                                value={form.category_id}
                                onChange={(e) => update("category_id", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            >
                                <option value="">Select…</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">Brand</label>
                            <select
                                value={form.brand_id || ""}
                                onChange={(e) => update("brand_id", e.target.value)}
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            >
                                <option value="">No brand</option>
                                {brands.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">Sub-category</label>
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
                    </div>

                    <div>
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">Type</label>
                        <input
                            type="text"
                            value={form.type || ""}
                            onChange={(e) => update("type", e.target.value)}
                            placeholder="Shirts, Shoes..."
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">Badge</label>
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
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">Status</label>
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
                            <input type="checkbox" checked={!!form.is_new_in} onChange={(e) => update("is_new_in", e.target.checked)} />
                            New In
                        </label>
                        <label className="flex items-center gap-2 text-xs text-[#432817]">
                            <input type="checkbox" checked={!!form.is_on_sale} onChange={(e) => update("is_on_sale", e.target.checked)} />
                            On sale
                        </label>
                        <label className="flex items-center gap-2 text-xs text-[#432817]">
                            <input type="checkbox" checked={!!form.featured} onChange={(e) => update("featured", e.target.checked)} />
                            Featured
                        </label>
                    </div>

                    {error && <p className="text-xs text-[#9B4635]">{error}</p>}

                    <button
                        type="submit"
                        disabled={saving || uploading}
                        className="mt-2 flex w-full items-center justify-center gap-2 bg-[#432817] py-3 text-[10px] font-medium tracking-[0.2em] text-[#EDE6DA] uppercase transition hover:bg-[#5a3720] disabled:opacity-50"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#EDE6DA]/40 border-t-[#EDE6DA]" />
                        )}
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

    const [categories, setCategories] = useState([]);
    const [brands, setBrands] = useState([]);

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [brandFilter, setBrandFilter] = useState("");
    const [collectionFilter, setCollectionFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [formMode, setFormMode] = useState(null);
    const [editingProduct, setEditingProduct] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [taxonomyPopover, setTaxonomyPopover] = useState(null); // null | "category" | "brand"

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const hasActiveFilters = !!(search || categoryFilter || brandFilter || collectionFilter || statusFilter);

    const loadTaxonomies = useCallback(async () => {
        try {
            const [catRes, brandRes] = await Promise.all([
                productFetch("/admin/categories"),
                productFetch("/admin/brands"),
            ]);
            setCategories(catRes.categories);
            setBrands(brandRes.brands);
        } catch (err) {
            push(err.message || "Could not load categories/brands.", "bad");
        }
    }, [push]);

    useEffect(() => { loadTaxonomies(); }, [loadTaxonomies]);

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
            const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), search });
            if (categoryFilter) params.set("category_id", categoryFilter);
            if (brandFilter) params.set("brand_id", brandFilter);
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
    }, [page, search, categoryFilter, brandFilter, collectionFilter, statusFilter]);

    useEffect(() => { loadProducts(); }, [loadProducts]);

    const clearFilters = () => {
        setSearchInput("");
        setCategoryFilter("");
        setBrandFilter("");
        setCollectionFilter("");
        setStatusFilter("");
    };

    const openCreate = () => {
        setEditingProduct(null);
        setFormMode("create");
    };

    const openEdit = (product) => {
        setEditingProduct({
            ...product,
            description: product.description || "",
            category_id: product.category_id ?? "",
            brand_id: product.brand_id ?? "",
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
            description: form.description?.trim() ? form.description.trim() : null,
            price: Number(form.price),
            sale_price: form.sale_price === "" ? null : Number(form.sale_price),
            category_id: Number(form.category_id),
            brand_id: form.brand_id ? Number(form.brand_id) : null,
            is_new_in: form.is_new_in ? 1 : 0,
            is_on_sale: form.is_on_sale ? 1 : 0,
            featured: form.featured ? 1 : 0,
        };

        try {
            if (formMode === "create") {
                await productFetch("/admin/products", { method: "POST", body: JSON.stringify(payload) });
                push(`${form.name} added to the catalog.`, "good");
            } else {
                await productFetch(`/admin/products/${editingProduct.id}`, { method: "PATCH", body: JSON.stringify(payload) });
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
                categories={categories}
                brands={brands}
                onSave={handleSave}
                onClose={closeForm}
                saving={saving}
            />
            <ConfirmPopover product={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
            {taxonomyPopover && (
                <TaxonomyPopover
                    kind={taxonomyPopover}
                    onClose={() => setTaxonomyPopover(null)}
                    onChanged={loadTaxonomies}
                    push={push}
                />
            )}

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
                        <button type="button" onClick={() => setSearchInput("")} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#7E7E86] hover:text-[#432817]">
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
                    {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                <select
                    value={brandFilter}
                    onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}
                    className="border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                >
                    <option value="">All brands</option>
                    {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
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

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="text-[9px] font-medium tracking-[0.15em] text-[#9B4635] uppercase underline underline-offset-2 hover:text-[#7a3226]"
                    >
                        Clear filters
                    </button>
                )}

                <div className="ml-auto flex gap-2">
                    <button
                        type="button"
                        onClick={() => setTaxonomyPopover("category")}
                        className="flex items-center gap-1.5 border border-[#A78361] px-3 py-2 text-[9px] font-medium tracking-[0.15em] uppercase text-[#432817] hover:bg-[#432817] hover:text-[#EDE6DA]"
                    >
                        <Tag size={12} /> Categories
                    </button>
                    <button
                        type="button"
                        onClick={() => setTaxonomyPopover("brand")}
                        className="flex items-center gap-1.5 border border-[#A78361] px-3 py-2 text-[9px] font-medium tracking-[0.15em] uppercase text-[#432817] hover:bg-[#432817] hover:text-[#EDE6DA]"
                    >
                        <Tag size={12} /> Brands
                    </button>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="flex items-center gap-2 bg-[#432817] px-4 py-2 text-[9px] font-medium tracking-[0.18em] text-[#EDE6DA] uppercase hover:bg-[#5a3720]"
                    >
                        <Plus size={13} /> Add product
                    </button>
                </div>
            </div>

            {errorMessage && (
                <div className="mb-5 flex items-center justify-between gap-4 border-l-2 border-[#9B4635] bg-[#9B4635]/5 px-4 py-3 text-xs text-[#7a3226]">
                    <span>{errorMessage}</span>
                    <button type="button" onClick={loadProducts} className="shrink-0 font-medium underline">
                        Retry
                    </button>
                </div>
            )}

            {/* Products grid */}
            {loading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                    ))}
                </div>
            ) : products.length === 0 ? (
                <div className="py-14 text-center">
                    <p className="font-serif text-lg text-[#432817]">No products match those filters.</p>
                    <p className="mt-1 text-[11px] text-[#7E7E86]">Try clearing a filter, or add a new product.</p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-4 text-[10px] font-medium tracking-[0.15em] text-[#432817] uppercase underline underline-offset-2"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {products.map((p) => (
                        <div key={p.id} className="group relative border border-[#D1B79E]/60 bg-white/40 transition-shadow hover:shadow-[0_4px_20px_rgba(67,40,23,0.08)]">
                            <div className="relative aspect-[3/4] overflow-hidden bg-[#D1B79E]/20">
                                {p.image ? (
                                    <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
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
                                    <button type="button" onClick={() => openEdit(p)} className="rounded-full bg-white/90 p-1.5 text-[#432817] hover:bg-white">
                                        <Pencil size={12} />
                                    </button>
                                    <button type="button" onClick={() => setDeleteTarget(p)} className="rounded-full bg-white/90 p-1.5 text-[#9B4635] hover:bg-white">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-3">
                                <p className="truncate text-xs font-medium text-[#432817]">{p.name}</p>
                                <p className="mt-0.5 text-[10px] text-[#7E7E86]">
                                    {p.category_name || "—"}{p.brand_name ? ` · ${p.brand_name}` : ""}
                                </p>
                                {p.description && (
                                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-[#9C8C7A]">
                                        {p.description}
                                    </p>
                                )}
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
                <span>Page {page} of {totalPages} · {total} product{total === 1 ? "" : "s"}</span>
                <div className="flex gap-1">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 uppercase tracking-wide hover:text-[#432817] disabled:opacity-30">
                        Prev
                    </button>
                    <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1.5 uppercase tracking-wide hover:text-[#432817] disabled:opacity-30">
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}