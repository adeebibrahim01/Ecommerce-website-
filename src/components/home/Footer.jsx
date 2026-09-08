export default function Footer() {
  return (
    <footer className="border-t border-[#D1B79E]/60 bg-[#432817] text-[#EDE6DA]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:px-12 lg:px-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <h2 className="font-serif text-3xl tracking-[0.1em]">
              AURELIA
            </h2>

            <p className="mt-5 max-w-sm text-xs leading-6 text-[#D1B79E]">
              Timeless fashion for the modern wardrobe. Discover carefully
              curated collections designed around effortless elegance.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="mb-5 text-[9px] font-medium tracking-[0.25em] uppercase">
              Shop
            </h3>

            <div className="flex flex-col gap-3 text-xs text-[#D1B79E]">
              <button className="text-left transition hover:text-white">
                New Arrivals
              </button>

              <button className="text-left transition hover:text-white">
                Women
              </button>

              <button className="text-left transition hover:text-white">
                Men
              </button>

              <button className="text-left transition hover:text-white">
                Accessories
              </button>
            </div>
          </div>

          {/* Help */}
          <div>
            <h3 className="mb-5 text-[9px] font-medium tracking-[0.25em] uppercase">
              Help
            </h3>

            <div className="flex flex-col gap-3 text-xs text-[#D1B79E]">
              <button className="text-left transition hover:text-white">
                Contact
              </button>

              <button className="text-left transition hover:text-white">
                Shipping
              </button>

              <button className="text-left transition hover:text-white">
                Returns
              </button>

              <button className="text-left transition hover:text-white">
                Privacy
              </button>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-14 flex flex-col gap-4 border-t border-[#D1B79E]/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[9px] tracking-[0.15em] text-[#D1B79E] uppercase">
            © 2026 AURELIA
          </p>

          <p className="text-[9px] tracking-[0.15em] text-[#D1B79E] uppercase">
            Crafted with timeless style
          </p>
        </div>
      </div>
    </footer>
  );
}