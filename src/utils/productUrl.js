// ─────────────────────────────────────────────────────────────
// Shared helper for professional, SEO-friendly product URLs.
//
// Instead of a bare numeric id ("/product/5"), we build a URL that
// carries the product name as a slug with the id at the end
// ("/product/elegant-silk-evening-dress-5"). The id at the end is
// what we actually read — the slug text is just for humans and
// search engines, so it never needs to be "correct" for the page
// to work.
// ─────────────────────────────────────────────────────────────

/**
 * Turn a product name into a URL-safe slug.
 * "Elegant Silk Evening Dress" -> "elegant-silk-evening-dress"
 */
export function slugify(text) {
    return String(text || "")
        .toLowerCase()
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "") // strip accents
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

/**
 * Build the canonical product detail path from a product's name + id.
 * Use this everywhere a product link is created (ProductCard, grids,
 * admin tables, search results, etc.) so links are consistent.
 */
export function getProductPath(product) {
    if (!product?.id) return "/";
    const slug = slugify(product.name);
    return slug ? `/product/${slug}-${product.id}` : `/product/${product.id}`;
}

/**
 * Pull the numeric id back out of a product URL param.
 * Works whether the param is a bare id ("5") — for old links or
 * anyone typing a raw id — or the full slug ("elegant-dress-5").
 * Returns null if no id could be found.
 */
export function parseProductId(slugParam) {
    if (!slugParam) return null;
    const match = String(slugParam).match(/(\d+)$/);
    return match ? match[1] : null;
}