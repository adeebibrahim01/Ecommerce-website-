import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "https://product-worker-service.adeebibrahim01.workers.dev";

function BrandCellSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 border-b border-r border-[#D8CFC2] px-4 py-8">
            <div className="h-10 w-10 animate-pulse rounded-full bg-[#D1B79E]/40" />
            <div className="h-2.5 w-14 animate-pulse rounded-full bg-[#D1B79E]/30" />
        </div>
    );
}

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
            <div className="mx-auto max-w-6xl">
                <h1 className="font-serif text-4xl tracking-tight">All Brands</h1>
                <p className="mt-2 text-xs text-[#7E7E86]">
                    {loading ? "Loading…" : `${brands.length} brand${brands.length === 1 ? "" : "s"}`}
                </p>

                {loading ? (
                    <div className="mt-8 grid grid-cols-2 border-l border-t border-[#D8CFC2] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
                        {Array.from({ length: 14 }).map((_, i) => (
                            <BrandCellSkeleton key={i} />
                        ))}
                    </div>
                ) : brands.length === 0 ? (
                    <p className="mt-10 text-sm text-[#7E7E86]">No brands added yet.</p>
                ) : (
                    <div className="mt-8 grid grid-cols-2 border-l border-t border-[#D8CFC2] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
                        {brands.map((brand) => (
                            <button
                                key={brand.id}
                                type="button"
                                onClick={() => navigate(`/brands/${brand.slug}`)}
                                className="group flex flex-col items-center justify-center gap-3 border-b border-r border-[#D8CFC2] px-4 py-8 transition-colors duration-200 hover:bg-white/40"
                            >
                                {brand.logo ? (
                                    <img
                                        src={brand.logo}
                                        alt={brand.name}
                                        className="h-10 w-10 shrink-0 rounded-full object-cover transition-transform duration-200 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#D1B79E]/30 font-serif text-sm transition-transform duration-200 group-hover:scale-110">
                                        {brand.name.charAt(0)}
                                    </div>
                                )}
                                <span className="text-center text-[11px] tracking-[0.08em] text-[#432817] uppercase group-hover:text-[#977150]">
                                    {brand.name}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}