import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Tag, RotateCcw, PackageSearch } from "lucide-react";

import { DEALS_API_URL } from "../../utils/deals";

function DealCardSkeleton() {
    return (
        <div>
            <div className="aurelia-shimmer aspect-[4/3] w-full overflow-hidden rounded-[1.5rem]" />
            <div className="pt-4">
                <div className="aurelia-shimmer mb-3 h-2.5 w-20 rounded-full" />
                <div className="aurelia-shimmer h-4 w-40 rounded-full" />
            </div>
        </div>
    );
}

export default function DealsPage() {
    const [deals, setDeals] = useState([]);
    const [status, setStatus] = useState("loading"); // loading | ready | error
    const [error, setError] = useState("");
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;

        async function load() {
            setStatus("loading");
            setError("");

            try {
                const res = await fetch(`${DEALS_API_URL}/deals`, { signal: controller.signal });
                if (!res.ok) throw new Error(`Failed to load deals (status ${res.status})`);
                const data = await res.json();
                if (!data?.success) throw new Error(data?.message || "Failed to load deals.");

                if (!cancelled) {
                    setDeals(data.deals || []);
                    setStatus("ready");
                }
            } catch (err) {
                if (cancelled || err.name === "AbortError") return;
                console.error("Deals fetch error:", err);
                setError(err.message || "Failed to load deals.");
                setStatus("error");
            }
        }

        load();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [reloadToken]);

    return (
        <section className="relative overflow-hidden bg-[#EDE6DA]">
            <style>{`
        @keyframes aurelia-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .aurelia-grid-item {
          animation: aurelia-rise 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: var(--aurelia-delay, 0ms);
        }
        @keyframes aurelia-shimmer-sweep {
          0% { background-position: -300% 0; }
          100% { background-position: 300% 0; }
        }
        .aurelia-shimmer {
          background-color: rgba(209, 183, 158, 0.28);
          background-image: linear-gradient(
            100deg,
            rgba(209, 183, 158, 0.28) 30%,
            rgba(255, 255, 255, 0.65) 50%,
            rgba(209, 183, 158, 0.28) 70%
          );
          background-size: 300% 100%;
          animation: aurelia-shimmer-sweep 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .aurelia-grid-item { animation: none; }
          .aurelia-shimmer { animation: none; background-image: none; }
        }
      `}</style>

            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/25 to-transparent" />

            <div className="relative mx-auto max-w-[1600px] px-4 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-16 xl:px-16">
                <div className="mb-9 lg:mb-12">
                    <p className="mb-2 text-[9px] font-semibold tracking-[0.24em] text-[#8A8177] uppercase">
                        Limited-time offers
                    </p>
                    <h1 className="font-serif text-3xl leading-none tracking-[-0.02em] text-[#432817] sm:text-4xl lg:text-[2.75rem]">
                        Current Deals
                    </h1>
                </div>

                {status === "loading" && (
                    <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <DealCardSkeleton key={i} />
                        ))}
                    </div>
                )}

                {status === "error" && (
                    <div className="flex min-h-[460px] items-center justify-center">
                        <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#D8CFC2] bg-white/25 px-6 py-16 text-center shadow-[0_20px_60px_rgba(67,40,23,0.04)] backdrop-blur-sm sm:px-12">
                            <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#CFC4B5] bg-[#EDE6DA]">
                                <RotateCcw size={20} strokeWidth={1.3} className="text-[#432817]" />
                            </div>
                            <p className="mb-3 text-[9px] font-semibold tracking-[0.25em] text-[#8A8177] uppercase">
                                Something went wrong
                            </p>
                            <h3 className="font-serif text-3xl tracking-[-0.02em] text-[#432817] sm:text-4xl">
                                Couldn't load deals
                            </h3>
                            <p className="mx-auto mt-4 max-w-sm text-xs leading-6 text-[#7E7E86]">{error}</p>
                            <button
                                type="button"
                                onClick={() => setReloadToken((n) => n + 1)}
                                className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-[#432817] bg-[#432817] px-7 py-3 text-[9px] font-semibold tracking-[0.18em] text-white uppercase transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#5A3926] hover:shadow-lg"
                            >
                                <RotateCcw size={12} strokeWidth={1.8} />
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {status === "ready" && deals.length === 0 && (
                    <div className="flex min-h-[460px] items-center justify-center">
                        <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#D8CFC2] bg-white/25 px-6 py-16 text-center shadow-[0_20px_60px_rgba(67,40,23,0.04)] backdrop-blur-sm sm:px-12">
                            <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#CFC4B5] bg-[#EDE6DA]">
                                <PackageSearch size={20} strokeWidth={1.3} className="text-[#432817]" />
                            </div>
                            <p className="mb-3 text-[9px] font-semibold tracking-[0.25em] text-[#8A8177] uppercase">
                                Nothing here yet
                            </p>
                            <h3 className="font-serif text-3xl tracking-[-0.02em] text-[#432817] sm:text-4xl">
                                No active deals right now
                            </h3>
                            <p className="mx-auto mt-4 max-w-sm text-xs leading-6 text-[#7E7E86]">
                                Check back soon — new deals go live regularly.
                            </p>
                        </div>
                    </div>
                )}

                {status === "ready" && deals.length > 0 && (
                    <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                        {deals.map((deal, index) => (
                            <Link
                                key={deal.id}
                                to={`/deals/${deal.id}`}
                                className="aurelia-grid-item group block"
                                style={{ "--aurelia-delay": `${Math.min(index * 60, 300)}ms` }}
                            >
                                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.5rem] border border-[#D8CFC2]">
                                    {deal.image ? (
                                        <img
                                            src={deal.image}
                                            alt={deal.name}
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="h-full w-full bg-[#D1B79E]" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#432817]/70 via-[#432817]/10 to-transparent" />

                                    <div className="absolute left-4 top-4 flex items-center gap-2">
                                        <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[9px] font-semibold tracking-[0.1em] text-[#432817]">
                                            <Tag size={11} strokeWidth={1.6} />
                                            {deal.label || `${deal.value}${deal.type === "%" ? "% OFF" : " OFF"}`}
                                        </span>
                                        <span className="rounded-full bg-[#432817]/85 px-3 py-1.5 text-[9px] font-semibold tracking-[0.1em] text-white uppercase backdrop-blur-sm">
                                            {deal.apply_to}
                                        </span>
                                    </div>
                                </div>
                                <h2 className="mt-4 font-serif text-xl text-[#432817] transition-colors group-hover:text-[#977150] sm:text-2xl">
                                    {deal.name}
                                </h2>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}