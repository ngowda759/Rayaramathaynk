import Link from "next/link";
import { CalendarDays, MoonStar, PartyPopper, ArrowRight } from "lucide-react";
import { calendar } from "@/data/calendar";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function TempleCalendarPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-[#fff8ef] via-white to-[#fffdf8]">

        {/* Hero */}

        <section className="border-b border-amber-100 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50">

          <div className="mx-auto max-w-7xl px-6 py-16">
            
            <Breadcrumb current="Temple Calendar" />

          <div className="text-center">

            <div className="inline-flex items-center rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold uppercase tracking-wider text-amber-700">
              Temple Calendar
            </div>

            <h1 className="mt-6 text-5xl font-bold text-stone-900">
              Sri {calendar.samvatsara} Samvatsara
            </h1>

            <p className="mt-6 mx-auto max-w-3xl text-lg leading-8 text-stone-600">
              Annual spiritual calendar containing Ekadashi schedules,
              major festivals and important celebrations observed at
              Sri Raghavendra Swamy Matha.
            </p>

          </div>

        </div>

      </section>

      {/* Cards */}

      <section className="mx-auto max-w-7xl px-6 py-20">

        <div className="grid gap-8 lg:grid-cols-2">

          {/* Ekadashi */}

          <Link
            href="/calendar/ekadashi"
            className="group rounded-3xl border border-amber-100 bg-white p-10 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
          >

            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white">

              <MoonStar size={38} />

            </div>

            <h2 className="mt-8 text-3xl font-bold text-stone-900">
              Ekadashi Schedule
            </h2>

            <p className="mt-4 leading-7 text-stone-600">
              View the complete Ekadashi calendar for the current
              Samvatsara.
            </p>

            <div className="mt-10 flex items-center justify-between">

              <div>

                <p className="text-5xl font-bold text-amber-600">
                  {calendar.ekadashi.length}
                </p>

                <p className="text-sm text-stone-500">
                  Sacred Ekadashis
                </p>

              </div>

              <span className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white group-hover:scale-105 transition">

                View Schedule

                <ArrowRight size={18} />

              </span>

            </div>

          </Link>

          {/* Festivals */}

          <Link
            href="/calendar/festivals"
            className="group rounded-3xl border border-amber-100 bg-white p-10 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
          >

            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 text-white">

              <PartyPopper size={38} />

            </div>

            <h2 className="mt-8 text-3xl font-bold text-stone-900">
              Festival Calendar
            </h2>

            <p className="mt-4 leading-7 text-stone-600">
              Browse all important Hindu festivals celebrated
              during the year.
            </p>

            <div className="mt-10 flex items-center justify-between">

              <div>

                <p className="text-5xl font-bold text-amber-600">
                  {calendar.festivals.length}
                </p>

                <p className="text-sm text-stone-500">
                  Major Festivals
                </p>

              </div>

              <span className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white group-hover:scale-105 transition">

                View Calendar

                <ArrowRight size={18} />

              </span>

            </div>

          </Link>

        </div>

        {/* Coming Soon */}

        <div className="mt-12 rounded-3xl border border-dashed border-amber-200 bg-amber-50 p-10 text-center">

          <CalendarDays
            className="mx-auto text-amber-600"
            size={42}
          />

          <h3 className="mt-6 text-2xl font-bold text-stone-900">
            More Spiritual Calendars Coming Soon
          </h3>

          <p className="mt-4 text-stone-600">

            Madhwa Aradhana Calendar • Temple Utsavas • Panchanga •
            Special Poojas

          </p>

        </div>

      </section>

      </main>
      <Footer />
    </>
  );
}
