import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-amber-50 via-white to-stone-100">
      <div className="mx-auto max-w-7xl px-6 py-24 text-center">

        <p className="text-amber-700 font-semibold tracking-[0.3em] uppercase">
          Yelahanka New Town
        </p>

        <h1 className="mt-6 text-5xl md:text-7xl font-bold leading-tight">
          Sri Raghavendra
          <br />
          Swamy Temple
        </h1>

        <p className="mt-8 text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-8">
          A sacred place of devotion, service and spiritual enlightenment.
          Experience the divine blessings of Sri Raghavendra Swamy through
          daily poojas, sevas and community events.
        </p>

        <div className="mt-12 flex justify-center gap-5 flex-wrap">

          <button className="rounded-xl bg-amber-600 px-8 py-4 text-white font-semibold hover:bg-amber-700 transition">
            Donate
          </button>

          <button className="rounded-xl border border-gray-300 bg-white px-8 py-4 font-semibold hover:bg-gray-100 transition flex items-center gap-2">
            Book Seva
            <ArrowRight size={18} />
          </button>

        </div>

      </div>
    </section>
  );
}
