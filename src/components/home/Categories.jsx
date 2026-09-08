const categories = [
  {
    name: "Women",
    image:
      "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Men",
    image:
      "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=900&q=85",
  },
  {
    name: "Accessories",
    image:
      "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?auto=format&fit=crop&w=900&q=85",
  },
];

export default function Categories() {
  return (
    <section className="px-5 py-20 sm:px-8 md:px-12 lg:px-16">
      <div className="mx-auto max-w-7xl">
        {/* Heading */}
        <div className="mb-10">
          <p className="mb-3 text-[10px] font-medium tracking-[0.3em] text-[#977150] uppercase">
            Explore
          </p>

          <h2 className="font-serif text-4xl leading-none sm:text-5xl">
            Shop by category
          </h2>
        </div>

        {/* Categories */}
        <div className="grid gap-4 md:grid-cols-3">
          {categories.map((category) => (
            <button
              key={category.name}
              className="group relative h-[420px] overflow-hidden text-left"
            >
              <img
                src={category.image}
                alt={category.name}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-black/15 transition group-hover:bg-black/25" />

              <div className="absolute bottom-7 left-7 text-white">
                <h3 className="font-serif text-3xl">
                  {category.name}
                </h3>

                <span className="mt-2 inline-block border-b border-white pb-1 text-[9px] tracking-[0.2em] uppercase">
                  Explore
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}