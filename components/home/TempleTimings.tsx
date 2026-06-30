import {
  Clock3,
  Sunrise,
  Sunset,
  CalendarHeart,
} from "lucide-react";

export default function TempleTimings() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">

        <div className="text-center">
          <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
            Darshan Timings
          </span>

          <h2 className="mt-6 text-4xl font-bold text-stone-900 md:text-5xl">
            Temple Timings
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-600">
            We warmly welcome devotees every day. Please plan your visit
            according to the timings below.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">

          {/* Morning */}

          <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-10 shadow-sm">

            <div className="flex items-center gap-4">

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-600 text-white">
                <Sunrise size={30} />
              </div>

              <div>
                <p className="text-sm uppercase tracking-widest text-amber-700">
                  Morning
                </p>

                <h3 className="text-3xl font-bold text-stone-900">
                  6:00 AM – 1:00 PM
                </h3>
              </div>

            </div>

            <div className="mt-8 space-y-4 text-stone-700">

              <div className="flex items-center gap-3">
                <Clock3 size={18} className="text-amber-600" />
                Suprabhata Seva
              </div>

              <div className="flex items-center gap-3">
                <Clock3 size={18} className="text-amber-600" />
                Alankara & Maha Pooja
              </div>

              <div className="flex items-center gap-3">
                <Clock3 size={18} className="text-amber-600" />
                Darshan & Prasada
              </div>

            </div>

          </div>

          {/* Evening */}

          <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 p-10 shadow-sm">

            <div className="flex items-center gap-4">

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <Sunset size={30} />
              </div>

              <div>
                <p className="text-sm uppercase tracking-widest text-blue-700">
                  Evening
                </p>

                <h3 className="text-3xl font-bold text-stone-900">
                  4:30 PM – 8:30 PM
                </h3>
              </div>

            </div>

            <div className="mt-8 space-y-4 text-stone-700">

              <div className="flex items-center gap-3">
                <Clock3 size={18} className="text-blue-600" />
                Evening Pooja
              </div>

              <div className="flex items-center gap-3">
                <Clock3 size={18} className="text-blue-600" />
                Mangalarati
              </div>

              <div className="flex items-center gap-3">
                <Clock3 size={18} className="text-blue-600" />
                Darshan Until Closing
              </div>

            </div>

          </div>

        </div>

        <div className="mt-12 rounded-3xl bg-gradient-to-r from-amber-600 to-orange-600 p-8 text-white shadow-xl">

          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">

            <div className="flex items-center gap-4">

              <div className="rounded-2xl bg-white/20 p-4">
                <CalendarHeart size={32} />
              </div>

              <div>

                <h3 className="text-2xl font-bold">
                  Festival Timings
                </h3>

                <p className="mt-2 text-amber-100">
                  On festival days, temple timings may be extended. Please
                  check announcements before planning your visit.
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
