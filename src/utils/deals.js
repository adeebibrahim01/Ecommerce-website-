export const DEALS_API_URL =
    import.meta.env.VITE_DEALS_API_URL ||
    "https://deals-worker-service.adeebibrahim01.workers.dev";

export const PRODUCT_API_URL =
    import.meta.env.VITE_PRODUCT_API_URL ||
    "https://product-worker-service.adeebibrahim01.workers.dev";

// value=20, type='%' on price=120 -> 96
// value=20, type='$' on price=120 -> 100
export function computeDiscountedPrice(price, value, type) {
    const original = Number(price);
    const amount = Number(value);
    if (!Number.isFinite(original) || !Number.isFinite(amount)) return original;

    const discounted =
        type === "%" ? original - (original * amount) / 100 : original - amount;

    return Math.round(Math.max(0, discounted) * 100) / 100;
}

export function formatMoney(value) {
    return typeof value === "number" ? `$${value.toLocaleString()}` : `$${value}`;
}

// Product worker rows are snake_case, ProductCard expects camelCase.
// Baseline is `sale_price ?? price` — same price CategoryPage.jsx /
// BrandProducts.jsx already display elsewhere on the site.
export function normalizeProduct(row) {
    return {
        id: row.id,
        name: row.name,
        price: row.sale_price ?? row.price,
        image: row.image,
        type: row.type,
        badge: row.badge,
    };
}

// Product-type deal items already come joined from the Deals worker
// (attachDealItems -> `p.id, p.name, p.image, p.price`), no extra request.
export function productFromDealItem(item) {
    return { id: item.id, name: item.name, price: item.price, image: item.image };
}

export function dedupeById(products) {
    const seen = new Set();
    const result = [];
    for (const product of products) {
        if (product?.id == null || seen.has(product.id)) continue;
        seen.add(product.id);
        result.push(product);
    }
    return result;
}

// Pagination-safe /products fetch by category or brand slug — identical
// walking pattern to fetchAllProducts() in CategoryPage.jsx and
// fetchAllProductsByBrand() in BrandProducts.jsx, just parameterized.
export async function fetchAllProductsBySlug(paramName, slug, signal) {
    const all = [];
    let page = 1;
    const limit = 50;

    while (true) {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        params.set(paramName, slug);

        const res = await fetch(`${PRODUCT_API_URL}/products?${params.toString()}`, { signal });
        if (!res.ok) throw new Error(`Failed to load products (status ${res.status})`);

        const data = await res.json();
        if (!data?.success) throw new Error(data?.message || "Failed to load products.");

        all.push(...(data.products || []));

        const total = data.total || 0;
        if (all.length >= total || (data.products || []).length < limit) break;
        page += 1;
    }

    return all;
}

// Resolves a deal's `items` (product rows OR category/brand rows) into a
// flat, deduped product list. Pass a shared `slugCache` Map across multiple
// deals (e.g. the deals list page) so the same category/brand isn't
// fetched twice.
export async function resolveDealProducts(deal, slugCache, signal) {
    const cache = slugCache || new Map();

    if (deal.apply_to === "product") {
        return dedupeById((deal.items || []).map(productFromDealItem));
    }

    const paramName = deal.apply_to === "category" ? "category" : "brand";
    const slugs = [...new Set((deal.items || []).map((item) => item.slug).filter(Boolean))];

    const perSlugResults = await Promise.all(
        slugs.map(async (slug) => {
            const cacheKey = `${paramName}:${slug}`;
            if (cache.has(cacheKey)) return cache.get(cacheKey);
            const rows = await fetchAllProductsBySlug(paramName, slug, signal);
            const normalized = rows.map(normalizeProduct);
            cache.set(cacheKey, normalized);
            return normalized;
        })
    );

    return dedupeById(perSlugResults.flat());
}