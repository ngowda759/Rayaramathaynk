"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, MoonStar, ArrowRight } from "lucide-react";
import { calendar } from "@/data/calendar";

export default function CalendarCenter() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#fff8ef] via-white to-[#fffdf8] py-24">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_40%)]" />

      <div className="relative mx-auto max-w-7xl px-6">

        <div className="mx-auto max-w-3xl text-center">

          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold tracking-wide text-amber-700">
            TEMPLE CALENDAR
          </span>

          <h2 className="mt-6 text-5xl font-bold text-stone-900">
            Sacred Calendar
          </h2>

          <p className="mt-6 text-lg leading-8 text-stone-600">
            Stay connected with Sri Matha through Ekadashi schedules,
            festival celebrations and important spiritual dates.
          </p>

        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">

          {/* Ekadashi */}

          <motion.div
            whileHover={{ y: -8 }}
            transition={{ duration: 0.25 }}
            className="group rounded-[32px] border border-amber-100 bg-white p-10 shadow-lg transition-all hover:shadow-2xl"
          >

            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-sky-600 text-white shadow-xl">
              <MoonStar size={36} />
            </div>

            <h3 className="mt-8 text-3xl font-bold text-stone-900">
              Ekadashi Schedule
            </h3>

            <p className="mt-4 text-stone-600 leading-7">
              Complete Ekadashi calendar for{" "}
              <span className="font-semibold">
                {calendar.samvatsara} Samvatsara
              </span>.
            </p>

            <div className="mt-8 flex items-center justify-between">

              <div>

                <p className="text-4xl font-bold text-amber-600">
                  {calendar.ekadashi.length}
                </p>

                <p className="text-sm text-stone-500">
                  Sacred Ekadashis
                </p>

              </div>

              <Link
                href="/calendar/ekadashi"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-105"
              >
                View Schedule
                <ArrowRight size={18} />
              </Link>

            </div>

          </motion.div>

          {/* Festivals */}

          <motion.div
            whileHover={{ y: -8 }}
            transition={{ duration: 0.25 }}
            className="group rounded-[32px] border border-amber-100 bg-white p-10 shadow-lg transition-all hover:shadow-2xl"
          >

            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-xl">
              <Calendar size={36} />
            </div>

            <h3 className="mt-8 text-3xl font-bold text-stone-900">
              Festival Calendar
            </h3>

            <p className="mt-4 text-stone-600 leading-7">
              Major Hindu festivals celebrated at
              Sri Matha throughout the year.
            </p>

            <div className="mt-8 flex items-center justify-between">

              <div>

                <p className="text-4xl font-bold text-amber-600">
                  {calendar.festivals.length}
                </p>

                <p className="text-sm text-stone-500">
                  Major Festivals
                </p>

              </div>

              <Link
                href="/calendar/festivals"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-105"
              >
                View Calendar
                <ArrowRight size={18} />
              </Link>

            </div>

          </motion.div>

        </div>

      </div>

    </section>
  );
}
