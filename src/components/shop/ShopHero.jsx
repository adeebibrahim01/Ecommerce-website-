export default function ShopHero({
  title = "Men",
  subtitle = "Refined essentials for the modern wardrobe.",
  image,
}) {
  return (
    <section className="relative h-[55vh] min-h-[420px] overflow-hidden bg-[#432817]">
      {image && (
        <img
          src={image}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-[#432817]/45" />

      <div className="relative z-10 flex h-full items-end">
        <div className="w-full px-6 pb-12 sm:px-10 lg:px-16 lg:pb-16">
          <div className="max-w-3xl">
            <p className="mb-4 text-[10px] font-medium tracking-[0.35em] text-[#EDE6DA] uppercase">
              AURELIA · Collection
            </p>

            <h1 className="font-serif text-6xl leading-[0.9] tracking-tight text-[#EDE6DA] sm:text-7xl lg:text-8xl">
              {title}
            </h1>

            <p className="mt-6 max-w-md text-sm leading-6 text-[#EDE6DA]/80">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}