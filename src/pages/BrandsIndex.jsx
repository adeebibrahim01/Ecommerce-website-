import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "https://product-worker-service.adeebibrahim01.workers.dev";

export default function BrandsIndex() {
    const navigate = useNavigate();
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        fetch(`${API_BASE_URL}/brands`)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                if (data.success) setBrands(data.brands || []);
            })
            .catch((err) => console.error("Could not load brands:", err))
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <main className="min-h-screen bg-[#EDE6DA] px-6 py-12 text-[#432817] sm:px-10">
            <div className="mx-auto max-w-4xl">
                <h1 className="font-serif text-4xl tracking-tight">All Brands</h1>
                <p className="mt-2 text-xs text-[#7E7E86]">
                    {loading ? "Loading…" : `${brands.length} brand${brands.length === 1 ? "" : "s"}`}
                </p>

                {loading ? (
                    <div className="mt-8 space-y-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-10 animate-pulse rounded-sm bg-[#D1B79E]/30" />
                        ))}
                    </div>
                ) : brands.length === 0 ? (
                    <p className="mt-10 text-sm text-[#7E7E86]">No brands added yet.</p>
                ) : (
                    <div className="mt-8 divide-y divide-[#D1B79E]/40 border-y border-[#D1B79E]/60">
                        {brands.map((brand) => (
                            <button
                                key={brand.id}
                                type="button"
                                onClick={() => navigate(`/brands/${brand.slug}`)}
                                className="flex w-full items-center justify-between py-4 text-left font-serif text-xl tracking-tight hover:text-[#977150]"
                            >
                                {brand.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}