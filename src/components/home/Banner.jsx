import { useEffect, useState } from "react";

// ==========================================
// BANNER API
// ==========================================

const BANNER_API =
  import.meta.env.VITE_BANNER_API_URL ||
  "https://banner-worker-service.adeebibrahim01.workers.dev";

// ==========================================
// SHIMMER
// ==========================================

function ShimmerBlock({ className = "" }) {
  return (
    <div
      className={`aurelia-home-shimmer ${className}`}
    />
  );
}

// ==========================================
// BANNER
// ==========================================

export default function Banner({
  placement = "home_secondary",
}) {
  const [banner, setBanner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    let cancelled = false;

    async function loadBanner() {
      try {
        setIsLoading(true);

        const url =
          `${BANNER_API}/banners?placement=` +
          encodeURIComponent(placement);

        const res = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(
            `Failed to load banner (${res.status})`
          );
        }

        const data = await res.json();

        if (!data?.success) {
          throw new Error(
            data?.message ||
              "Failed to load banner."
          );
        }

        const banners = Array.isArray(
          data.banners
        )
          ? data.banners
          : [];

        if (!cancelled) {
          setBanner(banners[0] || null);
        }
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        console.error(
          "Home banner fetch error:",
          error
        );

        if (!cancelled) {
          setBanner(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadBanner();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [placement]);

  // ==========================================
  // LOADING
  // ==========================================

  if (isLoading) {
    return (
      <section className="w-full pb-20">
        <div className="w-full overflow-hidden">
          <ShimmerBlock className="h-[500px] w-full sm:h-[600px]" />
        </div>
      </section>
    );
  }

  // ==========================================
  // NO DATABASE BANNER
  // ==========================================

  if (!banner) {
    return null;
  }

  // ==========================================
  // DATABASE BANNER
  // ==========================================

  return (
    <section className="w-full pb-20">
      <div className="relative w-full overflow-hidden">
        <img
          src={banner.image}
          alt={
            banner.text ||
            "AURELIA collection"
          }
          className="block h-[500px] w-full object-cover sm:h-[600px]"
          loading="lazy"
          decoding="async"
        />

        <div className="absolute inset-0 bg-[#432817]/25" />

        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
          <div>
            {banner.bottom_text && (
              <p className="mb-4 text-[10px] tracking-[0.35em] uppercase">
                {banner.bottom_text}
              </p>
            )}

            {banner.text && (
              <h2 className="font-serif text-5xl leading-none sm:text-7xl">
                {banner.text}

                {banner.subtext && (
                  <>
                    <br />
                    {banner.subtext}
                  </>
                )}
              </h2>
            )}

            {banner.button_text && (
              <a
                href={
                  banner.button_link || "#"
                }
                className="mt-8 inline-block border border-white px-7 py-3 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:bg-white hover:text-[#432817]"
              >
                {banner.button_text}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}