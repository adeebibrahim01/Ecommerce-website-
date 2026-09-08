import Navbar from "../components/home/Navbar";
import Hero from "../components/home/Hero";
import Categories from "../components/home/Categories";
import ProductCard from "../components/shop/ProductCard";
import Footer from "../components/home/Footer";

const products = [
  {
    id: 1,
    name: "Linen Tailored Blazer",
    price: "$129",
    image:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=85",
  },
  {
    id: 2,
    name: "Minimal Silk Dress",
    price: "$159",
    image:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=85",
  },
  {
    id: 3,
    name: "Classic Leather Bag",
    price: "$189",
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85",
  },
  {
    id: 4,
    name: "Relaxed Linen Shirt",
    price: "$89",
    image:
      "https://images.unsplash.com/photo-1603252110481-7ba873bf42ab?auto=format&fit=crop&w=800&q=85",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#EDE6DA] text-[#432817]">
   

      <main>
        <Hero />

        <Categories />

        {/* New Arrivals */}
        <section className="px-5 py-20 sm:px-8 md:px-12 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="mb-3 text-[10px] font-medium tracking-[0.3em] text-[#977150] uppercase">
                  Curated collection
                </p>

                <h2 className="font-serif text-4xl leading-none sm:text-5xl">
                  New Arrivals
                </h2>
              </div>

              <button className="hidden border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:text-[#977150] sm:block">
                View all
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  price={product.price}
                  image={product.image}
                />
              ))}
            </div>

            <div className="mt-10 text-center sm:hidden">
              <button className="border-b border-[#432817] pb-1 text-[10px] font-medium tracking-[0.2em] uppercase">
                View all
              </button>
            </div>
          </div>
        </section>

        {/* Editorial Campaign */}
        <section className="px-5 pb-20 sm:px-8 md:px-12 lg:px-16">
          <div className="relative mx-auto max-w-7xl overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=85"
              alt="Fashion collection"
              className="h-[500px] w-full object-cover sm:h-[600px]"
            />

            <div className="absolute inset-0 bg-[#432817]/25" />

            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
              <div>
                <p className="mb-4 text-[10px] tracking-[0.35em] uppercase">
                  The new collection
                </p>

                <h2 className="font-serif text-5xl leading-none sm:text-7xl">
                  Effortless
                  <br />
                  Elegance
                </h2>

                <button className="mt-8 border border-white px-7 py-3 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:bg-white hover:text-[#432817]">
                  Explore collection
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}