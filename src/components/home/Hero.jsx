import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-80px)] overflow-hidden">
      {/* Hero Image */}
      <img
        src="https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=2000&q=90"
        alt="New season fashion"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Content */}
      <div className="relative flex min-h-[calc(100vh-80px)] items-end px-5 pb-12 sm:px-8 sm:pb-16 md:px-12 lg:px-16">
        <div className="max-w-7xl">
          <p className="mb-5 text-[10px] font-medium tracking-[0.35em] text-white uppercase">
            Autumn / Winter 2026
          </p>

          <h1 className="max-w-3xl font-serif text-6xl leading-[0.88] tracking-tight text-white sm:text-7xl md:text-8xl lg:text-9xl">
            The art of
            <br />
            effortless style.
          </h1>

          <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <button className="group flex items-center gap-4 bg-[#EDE6DA] px-7 py-4 text-[10px] font-medium tracking-[0.2em] text-[#432817] uppercase transition hover:bg-[#432817] hover:text-[#EDE6DA]">
              Shop collection

              <ArrowRight
                size={15}
                strokeWidth={1.5}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>

            <button className="border-b border-white pb-1 text-[10px] font-medium tracking-[0.2em] text-white uppercase">
              Discover more
            </button>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 right-6 hidden flex-col items-center gap-3 text-white md:flex">
        <span className="text-[8px] tracking-[0.25em] uppercase [writing-mode:vertical-rl]">
          Scroll to explore
        </span>

        <span className="h-12 w-px bg-white/70" />
      </div>
    </section>
  );
}