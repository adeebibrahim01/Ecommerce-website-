import { useCallback, useEffect, useState } from "react";
import {
    Search,
    X,
    Plus,
    Pencil,
    Trash2,
    UploadCloud,
    Image as ImageIcon,
    Eye,
} from "lucide-react";

const API_BASE_URL =
  "https://banner-worker-service.adeebibrahim01.workers.dev";
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 350;

const CLOUDINARY_FOLDER = "Home/Banners";

const STATUSES = ["active", "draft", "archived"];

const PLACEMENTS = [
    { value: "home_hero", label: "Home — Hero" },
    { value: "home_secondary", label: "Home — Secondary" },
    { value: "men_hero", label: "Men — Hero" },
    { value: "women_hero", label: "Women — Hero" },
    { value: "sale_hero", label: "Sale — Hero" },
    { value: "new_in_hero", label: "New In — Hero" },
];

const EMPTY_BANNER = {
    placement: "home_hero",
    position: 1,
    image: "",
    text: "",
    subtext: "",
    bottom_text: "",
    button_text: "",
    button_link: "",
    status: "active",
};

async function bannerFetch(path, options = {}) {
    const token = localStorage.getItem("admin_auth_token");

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

async function uploadImageToCloudinary(file) {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        throw new Error(
            "Cloudinary configure nahi hai — .env mein VITE_CLOUDINARY_CLOUD_NAME aur VITE_CLOUDINARY_UPLOAD_PRESET set karein."
        );
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", CLOUDINARY_FOLDER);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
            method: "POST",
            body: formData,
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || "Image upload failed.");
    }

    return data.secure_url;
}

// ─────────────────────────────────────────────────────────────
// Escape
// ─────────────────────────────────────────────────────────────

function useEscapeToClose(isActive, isBusy, onEscape) {
    useEffect(() => {
        if (!isActive) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape" && !isBusy) {
                onEscape();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isActive, isBusy, onEscape]);
}

// ─────────────────────────────────────────────────────────────
// Toasts
// ─────────────────────────────────────────────────────────────

function useToasts() {
    const [toasts, setToasts] = useState([]);

    const push = useCallback((message, tone = "neutral") => {
        const id = Math.random().toString(36).slice(2);

        setToasts((prev) => [
            ...prev,
            {
                id,
                message,
                tone,
            },
        ]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3200);
    }, []);

    return {
        toasts,
        push,
    };
}

function ToastStack({ toasts }) {
    if (toasts.length === 0) return null;

    const borderColor = {
        good: "#6B7A5E",
        bad: "#9B4635",
        neutral: "#432817",
    };

    return (
        <div className="fixed bottom-6 right-6 z-[70] flex flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="min-w-[220px] max-w-xs border-l-2 bg-[#EDE6DA] px-4 py-3 text-xs text-[#432817] shadow-[0_4px_20px_rgba(67,40,23,0.12)]"
                    style={{
                        borderColor:
                            borderColor[toast.tone] || borderColor.neutral,
                    }}
                >
                    {toast.message}
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────

function BannerCardSkeleton() {
    return (
        <div className="overflow-hidden border border-[#D1B79E]/60 bg-white/40">
            <div className="aspect-[16/8] animate-pulse bg-[#D1B79E]/30" />

            <div className="space-y-2 p-4">
                <div className="h-3 w-3/4 animate-pulse rounded-sm bg-[#D1B79E]/40" />
                <div className="h-2.5 w-1/2 animate-pulse rounded-sm bg-[#D1B79E]/25" />
                <div className="h-2.5 w-full animate-pulse rounded-sm bg-[#D1B79E]/20" />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Delete confirmation
// ─────────────────────────────────────────────────────────────

function ConfirmPopover({ banner, onConfirm, onCancel }) {
    useEscapeToClose(!!banner, false, onCancel);

    if (!banner) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#432817]/25 px-4"
            onClick={onCancel}
        >
            <div
                className="w-full max-w-sm border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="font-serif text-lg leading-snug text-[#432817]">
                    Delete this banner?
                </p>

                <p className="mt-2 text-xs leading-5 text-[#7E7E86]">
                    This banner will be permanently removed. This can't be
                    undone.
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
// Banner form
// ─────────────────────────────────────────────────────────────

function BannerFormPopover({
    mode,
    initialData,
    onSave,
    onClose,
    saving,
}) {
    const [form, setForm] = useState(initialData || EMPTY_BANNER);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const [isDraggingImage, setIsDraggingImage] = useState(false);

    useEffect(() => {
        setForm(
            initialData
                ? {
                      ...EMPTY_BANNER,
                      ...initialData,
                      position: initialData.position ?? 1,
                  }
                : { ...EMPTY_BANNER }
        );

        setError("");
    }, [initialData, mode]);

    const busy = saving || uploading;

    const handleEscape = useCallback(() => {
        if (!busy) {
            onClose();
        }
    }, [busy, onClose]);

    useEscapeToClose(!!mode, busy, handleEscape);

    if (!mode) return null;

    const update = (field, value) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const processImageFile = async (file) => {
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError("Please select a valid image file.");
            return;
        }

        setUploading(true);
        setError("");

        try {
            const url = await uploadImageToCloudinary(file);
            update("image", url);
        } catch (err) {
            setError(err.message || "Image upload failed.");
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];

        e.target.value = "";

        await processImageFile(file);
    };

    const handleImageDrop = async (e) => {
        e.preventDefault();

        setIsDraggingImage(false);

        if (uploading) return;

        await processImageFile(e.dataTransfer.files?.[0]);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!form.placement.trim()) {
            setError("Placement is required.");
            return;
        }

        if (!form.position || Number(form.position) < 1) {
            setError("Position must be 1 or greater.");
            return;
        }

        if (!form.image.trim()) {
            setError("Banner image is required.");
            return;
        }

        if (!form.text.trim()) {
            setError("Banner text is required.");
            return;
        }

        setError("");

        onSave({
            ...form,
            placement: form.placement.trim(),
            position: Number(form.position),
            image: form.image.trim(),
            text: form.text.trim(),
            subtext: form.subtext?.trim() || null,
            bottom_text: form.bottom_text?.trim() || null,
            button_text: form.button_text?.trim() || null,
            button_link: form.button_link?.trim() || null,
            status: form.status || "active",
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#432817]/25 px-4"
            onClick={() => {
                if (!busy) onClose();
            }}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[#D1B79E] bg-[#EDE6DA] px-6 py-6"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-serif text-lg text-[#432817]">
                            {mode === "create"
                                ? "Add a new banner"
                                : "Edit banner"}
                        </p>

                        <p className="mt-1 text-[10px] text-[#7E7E86]">
                            Control where and how this banner appears on the
                            storefront.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        title="Close"
                        aria-label="Close"
                        className="text-[#7E7E86] transition-colors hover:text-[#432817] disabled:opacity-40"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="mt-6 space-y-5">
                    {/* Placement + position */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Placement{" "}
                                <span className="text-[#9B4635]">*</span>
                            </label>

                            <select
                                value={form.placement}
                                onChange={(e) =>
                                    update("placement", e.target.value)
                                }
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            >
                                {PLACEMENTS.map((placement) => (
                                    <option
                                        key={placement.value}
                                        value={placement.value}
                                    >
                                        {placement.label}
                                    </option>
                                ))}
                            </select>

                            <p className="mt-1 text-[9px] text-[#9C8C7A]">
                                Identifies where this banner is used.
                            </p>
                        </div>

                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Position{" "}
                                <span className="text-[#9B4635]">*</span>
                            </label>

                            <input
                                type="number"
                                min="1"
                                value={form.position}
                                onChange={(e) =>
                                    update("position", e.target.value)
                                }
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />

                            <p className="mt-1 text-[9px] text-[#9C8C7A]">
                                Lower number appears first.
                            </p>
                        </div>
                    </div>

                    {/* Image */}
                    <div>
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Banner image{" "}
                            <span className="text-[#9B4635]">*</span>
                        </label>

                        <label
                            className={`flex cursor-pointer items-center gap-2 border border-dashed px-4 py-4 text-xs transition-colors ${
                                isDraggingImage
                                    ? "border-[#432817] bg-[#432817]/5 text-[#432817]"
                                    : "border-[#D1B79E] text-[#7E7E86] hover:border-[#432817] hover:text-[#432817]"
                            }`}
                            onDragOver={(e) => {
                                e.preventDefault();

                                if (!uploading) {
                                    setIsDraggingImage(true);
                                }
                            }}
                            onDragLeave={() =>
                                setIsDraggingImage(false)
                            }
                            onDrop={handleImageDrop}
                        >
                            <UploadCloud size={15} />

                            {uploading
                                ? "Uploading…"
                                : "Click to upload, or drag & drop an image"}

                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                                disabled={uploading}
                            />
                        </label>

                        {uploading ? (
                            <div className="mt-3 aspect-[16/7] w-full animate-pulse bg-[#D1B79E]/30" />
                        ) : form.image ? (
                            <div className="relative mt-3 overflow-hidden border border-[#D1B79E]/60">
                                <img
                                    src={form.image}
                                    alt="Banner preview"
                                    className="aspect-[16/7] w-full object-cover"
                                />

                                <button
                                    type="button"
                                    onClick={() => update("image", "")}
                                    className="absolute right-2 top-2 bg-[#EDE6DA]/90 px-2 py-1 text-[9px] font-medium text-[#9B4635] uppercase"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {/* Main text */}
                    <div>
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Main text{" "}
                            <span className="text-[#9B4635]">*</span>
                        </label>

                        <input
                            type="text"
                            value={form.text}
                            onChange={(e) =>
                                update("text", e.target.value)
                            }
                            placeholder="Discover the new collection"
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                        />
                    </div>

                    {/* Subtext */}
                    <div>
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Subtext
                        </label>

                        <textarea
                            value={form.subtext || ""}
                            onChange={(e) =>
                                update("subtext", e.target.value)
                            }
                            rows={2}
                            placeholder="Timeless pieces designed for everyday elegance."
                            className="w-full resize-none border border-[#D1B79E] bg-transparent px-3 py-2 text-xs leading-relaxed outline-none focus:border-[#432817]"
                        />
                    </div>

                    {/* Bottom text */}
                    <div>
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Bottom text
                        </label>

                        <input
                            type="text"
                            value={form.bottom_text || ""}
                            onChange={(e) =>
                                update("bottom_text", e.target.value)
                            }
                            placeholder="Limited time · Shop now"
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                        />
                    </div>

                    {/* Button */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Button text
                            </label>

                            <input
                                type="text"
                                value={form.button_text || ""}
                                onChange={(e) =>
                                    update("button_text", e.target.value)
                                }
                                placeholder="Shop now"
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                                Button link
                            </label>

                            <input
                                type="text"
                                value={form.button_link || ""}
                                onChange={(e) =>
                                    update("button_link", e.target.value)
                                }
                                placeholder="/new-in"
                                className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="mb-1 block text-[9px] font-medium tracking-[0.15em] text-[#7E7E86] uppercase">
                            Status
                        </label>

                        <select
                            value={form.status || "active"}
                            onChange={(e) =>
                                update("status", e.target.value)
                            }
                            className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs capitalize outline-none focus:border-[#432817]"
                        >
                            {STATUSES.map((status) => (
                                <option
                                    key={status}
                                    value={status}
                                    className="capitalize"
                                >
                                    {status}
                                </option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <p className="border-l-2 border-[#9B4635] bg-[#9B4635]/5 px-3 py-2 text-xs text-[#9B4635]">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={saving || uploading}
                        className="mt-2 flex w-full items-center justify-center gap-2 bg-[#432817] py-3 text-[10px] font-medium tracking-[0.2em] text-[#EDE6DA] uppercase transition hover:bg-[#5a3720] disabled:opacity-50"
                    >
                        {saving && (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#EDE6DA]/40 border-t-[#EDE6DA]" />
                        )}

                        {saving
                            ? "Saving…"
                            : mode === "create"
                              ? "Add banner"
                              : "Save changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export default function AdminBanners() {
    const { toasts, push } = useToasts();

    const [banners, setBanners] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState("");

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");

    const [placementFilter, setPlacementFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const [formMode, setFormMode] = useState(null);
    const [editingBanner, setEditingBanner] = useState(null);

    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const totalPages = Math.max(
        1,
        Math.ceil(total / PAGE_SIZE)
    );

    const hasActiveFilters = !!(
        search ||
        placementFilter ||
        statusFilter
    );

    // ─────────────────────────────────────────────────────────
    // Load banners
    // ─────────────────────────────────────────────────────────

    const loadBanners = useCallback(async () => {
        setLoading(true);
        setErrorMessage("");

        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(PAGE_SIZE),
            });

            if (search) {
                params.set("search", search);
            }

            if (placementFilter) {
                params.set("placement", placementFilter);
            }

            if (statusFilter) {
                params.set("status", statusFilter);
            }

            const res = await bannerFetch(
                `/admin/banners?${params.toString()}`
            );

            setBanners(res.banners || []);
            setTotal(Number(res.total || 0));
        } catch (err) {
            setErrorMessage(
                err.message ||
                    "Could not load banners. Try again in a moment."
            );
        } finally {
            setLoading(false);
        }
    }, [page, search, placementFilter, statusFilter]);

    useEffect(() => {
        loadBanners();
    }, [loadBanners]);

    // ─────────────────────────────────────────────────────────
    // Search debounce
    // ─────────────────────────────────────────────────────────

    useEffect(() => {
        const timeout = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [searchInput]);

    // ─────────────────────────────────────────────────────────
    // Filters
    // ─────────────────────────────────────────────────────────

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setPlacementFilter("");
        setStatusFilter("");
        setPage(1);
    };

    // ─────────────────────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditingBanner(null);
        setFormMode("create");
    };

    // ─────────────────────────────────────────────────────────
    // Edit
    // ─────────────────────────────────────────────────────────

    const openEdit = (banner) => {
        setEditingBanner({
            ...EMPTY_BANNER,
            ...banner,
            position: banner.position ?? 1,
        });

        setFormMode("edit");
    };

    const closeForm = () => {
        setFormMode(null);
        setEditingBanner(null);
    };

    // ─────────────────────────────────────────────────────────
    // Save
    // ─────────────────────────────────────────────────────────

    const handleSave = async (form) => {
        setSaving(true);

        const payload = {
            placement: form.placement,
            position: Number(form.position),
            image: form.image,
            text: form.text,
            subtext: form.subtext || null,
            bottom_text: form.bottom_text || null,
            button_text: form.button_text || null,
            button_link: form.button_link || null,
            status: form.status || "active",
        };

        try {
            if (formMode === "create") {
                await bannerFetch("/admin/banners", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });

                push("Banner added successfully.", "good");
            } else {
                await bannerFetch(
                    `/admin/banners/${editingBanner.id}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify(payload),
                    }
                );

                push("Banner updated successfully.", "good");
            }

            closeForm();

            await loadBanners();
        } catch (err) {
            push(
                err.message || "Could not save banner.",
                "bad"
            );
        } finally {
            setSaving(false);
        }
    };

    // ─────────────────────────────────────────────────────────
    // Delete
    // ─────────────────────────────────────────────────────────

    const handleDelete = async () => {
        const banner = deleteTarget;

        if (!banner) return;

        setDeleteTarget(null);

        try {
            await bannerFetch(
                `/admin/banners/${banner.id}`,
                {
                    method: "DELETE",
                }
            );

            push("Banner deleted.", "bad");

            await loadBanners();
        } catch (err) {
            push(
                err.message || "Could not delete banner.",
                "bad"
            );
        }
    };

    // ─────────────────────────────────────────────────────────
    // Placement label
    // ─────────────────────────────────────────────────────────

    const getPlacementLabel = (placement) => {
        const found = PLACEMENTS.find(
            (item) => item.value === placement
        );

        return found?.label || placement || "—";
    };

    return (
        <div>
            <ToastStack toasts={toasts} />

            <BannerFormPopover
                mode={formMode}
                initialData={editingBanner}
                onSave={handleSave}
                onClose={closeForm}
                saving={saving}
            />

            <ConfirmPopover
                banner={deleteTarget}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            {/* ─────────────────────────────────────────────── */}
            {/* Filters */}
            {/* ─────────────────────────────────────────────── */}

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="relative max-w-xs flex-1">
                    <Search
                        size={14}
                        className="absolute left-0 top-1/2 -translate-y-1/2 text-[#7E7E86]"
                    />

                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) =>
                            setSearchInput(e.target.value)
                        }
                        placeholder="Search banners"
                        className="w-full border-0 border-b border-[#D1B79E] bg-transparent py-2 pl-6 pr-6 text-xs outline-none placeholder:text-[#a89b8c] focus:border-[#432817]"
                    />

                    {searchInput && (
                        <button
                            type="button"
                            onClick={() => setSearchInput("")}
                            title="Clear search"
                            aria-label="Clear search"
                            className="absolute right-0 top-1/2 -translate-y-1/2 text-[#7E7E86] hover:text-[#432817]"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>

                <select
                    value={placementFilter}
                    onChange={(e) => {
                        setPlacementFilter(e.target.value);
                        setPage(1);
                    }}
                    className="border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs outline-none focus:border-[#432817]"
                >
                    <option value="">All placements</option>

                    {PLACEMENTS.map((placement) => (
                        <option
                            key={placement.value}
                            value={placement.value}
                        >
                            {placement.label}
                        </option>
                    ))}
                </select>

                <select
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                    }}
                    className="border-0 border-b border-[#D1B79E] bg-transparent py-2 text-xs capitalize outline-none focus:border-[#432817]"
                >
                    <option value="">All statuses</option>

                    {STATUSES.map((status) => (
                        <option
                            key={status}
                            value={status}
                            className="capitalize"
                        >
                            {status}
                        </option>
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

                <div className="ml-auto">
                    <button
                        type="button"
                        onClick={openCreate}
                        className="flex items-center gap-2 bg-[#432817] px-4 py-2 text-[9px] font-medium tracking-[0.18em] text-[#EDE6DA] uppercase transition-colors hover:bg-[#5a3720]"
                    >
                        <Plus size={13} />
                        Add banner
                    </button>
                </div>
            </div>

            {/* ─────────────────────────────────────────────── */}
            {/* Error */}
            {/* ─────────────────────────────────────────────── */}

            {errorMessage && (
                <div className="mb-5 flex items-center justify-between gap-4 border-l-2 border-[#9B4635] bg-[#9B4635]/5 px-4 py-3 text-xs text-[#7a3226]">
                    <span>{errorMessage}</span>

                    <button
                        type="button"
                        onClick={loadBanners}
                        className="shrink-0 font-medium underline"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* ─────────────────────────────────────────────── */}
            {/* Grid */}
            {/* ─────────────────────────────────────────────── */}

            {loading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <BannerCardSkeleton key={index} />
                    ))}
                </div>
            ) : banners.length === 0 ? (
                <div className="py-14 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center border border-[#D1B79E]">
                        <ImageIcon
                            size={18}
                            className="text-[#7E7E86]"
                        />
                    </div>

                    <p className="mt-4 font-serif text-lg text-[#432817]">
                        No banners found.
                    </p>

                    <p className="mt-1 text-[11px] text-[#7E7E86]">
                        Create a banner or change your filters.
                    </p>

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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {banners.map((banner) => (
                        <div
                            key={banner.id}
                            className="group overflow-hidden border border-[#D1B79E]/60 bg-white/40 transition-shadow hover:shadow-[0_4px_20px_rgba(67,40,23,0.08)]"
                        >
                            {/* Image */}
                            <div className="relative aspect-[16/8] overflow-hidden bg-[#D1B79E]/20">
                                {banner.image ? (
                                    <img
                                        src={banner.image}
                                        alt={banner.text || "Banner"}
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                        <ImageIcon
                                            size={24}
                                            className="text-[#7E7E86]"
                                        />
                                    </div>
                                )}

                                {/* Placement */}
                                <span className="absolute left-3 top-3 bg-[#432817] px-2 py-1 text-[8px] font-medium tracking-[0.1em] text-[#EDE6DA] uppercase">
                                    {getPlacementLabel(
                                        banner.placement
                                    )}
                                </span>

                                {/* Position */}
                                <span className="absolute left-3 bottom-3 bg-[#EDE6DA]/90 px-2 py-1 text-[8px] font-medium tracking-[0.1em] text-[#432817] uppercase">
                                    Position {banner.position}
                                </span>

                                {/* Status */}
                                {banner.status !== "active" && (
                                    <span className="absolute right-3 top-3 bg-[#7E7E86] px-2 py-1 text-[8px] font-medium tracking-[0.1em] text-[#EDE6DA] uppercase capitalize">
                                        {banner.status}
                                    </span>
                                )}

                                {/* Actions */}
                                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/40 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openEdit(banner)
                                        }
                                        title="Edit banner"
                                        aria-label={`Edit ${
                                            banner.text || "banner"
                                        }`}
                                        className="rounded-full bg-white/90 p-2 text-[#432817] transition-transform hover:scale-110 hover:bg-white"
                                    >
                                        <Pencil size={13} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setDeleteTarget(banner)
                                        }
                                        title="Delete banner"
                                        aria-label={`Delete ${
                                            banner.text || "banner"
                                        }`}
                                        className="rounded-full bg-white/90 p-2 text-[#9B4635] transition-transform hover:scale-110 hover:bg-white"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-[#432817]">
                                            {banner.text}
                                        </p>

                                        {banner.subtext && (
                                            <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[#7E7E86]">
                                                {banner.subtext}
                                            </p>
                                        )}
                                    </div>

                                    <Eye
                                        size={14}
                                        className="shrink-0 text-[#A78361]"
                                    />
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#D1B79E]/40 pt-3 text-[9px] text-[#7E7E86]">
                                    {banner.button_text && (
                                        <span>
                                            Button:{" "}
                                            <span className="text-[#432817]">
                                                {banner.button_text}
                                            </span>
                                        </span>
                                    )}

                                    {banner.button_link && (
                                        <span className="truncate">
                                            Link:{" "}
                                            <span className="text-[#432817]">
                                                {banner.button_link}
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─────────────────────────────────────────────── */}
            {/* Pagination */}
            {/* ─────────────────────────────────────────────── */}

            <div className="mt-6 flex items-center justify-between text-[11px] text-[#7E7E86]">
                <span>
                    Page {page} of {totalPages} · {total} banner
                    {total === 1 ? "" : "s"}
                </span>

                <div className="flex gap-1">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() =>
                            setPage((p) => Math.max(1, p - 1))
                        }
                        className="px-3 py-1.5 uppercase tracking-wide transition-colors hover:text-[#432817] disabled:opacity-30"
                    >
                        Prev
                    </button>

                    <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() =>
                            setPage((p) =>
                                Math.min(totalPages, p + 1)
                            )
                        }
                        className="px-3 py-1.5 uppercase tracking-wide transition-colors hover:text-[#432817] disabled:opacity-30"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}