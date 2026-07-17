"use client";

import { motion } from "framer-motion";
import {
  Clock3,
  Sunrise,
  Sunset,
  CalendarHeart,
  CheckCircle2,
} from "lucide-react";

import { useHomepage } from "@/hooks/useHomepage";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export default function TempleTimings() {
  const { homepage, loading } = useHomepage();
  const reducedMotion = useReducedMotion();

  if (loading) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-b from-[#fff8ef] via-white to-[#fffdf8] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex h-64 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          </div>
        </div>
      </section>
    );
  }

  const morningOpen = homepage?.morningOpen ?? "06:00 AM";
  const morningClose = homepage?.morningClose ?? "01:00 PM";
  const eveningOpen = homepage?.eveningOpen ?? "04:30 PM";
  const eveningClose = homepage?.eveningClose ?? "08:30 PM";

  const morningSchedule = homepage?.morningSchedule ?? [
    "Suprabhata Seva",
    "Alankara",
    "Darshan",
    "Theertha & Prasada",
  ];

  const eveningSchedule = homepage?.eveningSchedule ?? [
    "Evening Pooja",
    "Mangalarati",
    "Darshan",
    "Temple Closing",
  ];

  const festivalScheduleNote = homepage?.festivalScheduleNote ??
    "Temple timings may be extended during festivals, Raghavendra Swamygala Aaradhane, Navaratri and other special occasions. Please check announcements before visiting.";

  const isTempleOpen = homepage?.isTempleOpen ?? true;
  const totalHours = isTempleOpen
    ? `${morningOpen} - ${eveningClose}`
    : "Closed";

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#fff8ef] via-white to-[#fffdf8] py-24">

      <div className="mx-auto max-w-7xl px-6">

        <div className="mx-auto max-w-3xl text-center">

          <motion.span
            initial={reducedMotion ? {} : { opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700"
          >
            TEMPLE TIMINGS
          </motion.span>

          <motion.h2
            initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reducedMotion ? 0 : 0.1 }}
            className="mt-6 text-5xl font-bold text-stone-900"
          >
            Plan Your Visit
          </motion.h2>

          <motion.p
            initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reducedMotion ? 0 : 0.2 }}
            className="mt-6 text-lg leading-8 text-stone-600"
          >
            We welcome devotees every day for Darshan, Sevas and
            spiritual activities. Please plan your visit according
            to the timings below.
          </motion.p>

        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">

          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reducedMotion ? 0.01 : 0.5 }}
            className="rounded-[32px] border border-amber-100 bg-white p-10 shadow-xl transition-shadow duration-300 hover:shadow-2xl"
          >

            <div className="flex items-center gap-5">

              <div className="flex h-18 w-18 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white shadow-lg transition-transform duration-300 hover:scale-110">

                <Sunrise size={34} />

              </div>

              <div>

                <p className="font-semibold uppercase tracking-widest text-amber-700">
                  Morning Darshan
                </p>

                <h3 className="mt-2 text-4xl font-bold text-stone-900">
                  {morningOpen} – {morningClose}
                </h3>

              </div>

            </div>

            <div className="mt-10 space-y-5">

              {morningSchedule.map((item) => (

                <motion.div
                  key={item}
                  initial={reducedMotion ? {} : { opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: reducedMotion ? 0 : 0.1 }}
                  className="flex items-center gap-4 rounded-2xl bg-amber-50 p-4"
                >

                  <CheckCircle2
                    className="text-amber-600"
                    size={22}
                  />

                  <span className="font-medium text-stone-700">
                    {item}
                  </span>

                </motion.div>

              ))}

            </div>

          </motion.div>

          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reducedMotion ? 0.01 : 0.5 }}
            className="rounded-[32px] border border-sky-100 bg-white p-10 shadow-xl transition-shadow duration-300 hover:shadow-2xl"
          >

            <div className="flex items-center gap-5">

              <div className="flex h-18 w-18 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-blue-600 p-5 text-white shadow-lg transition-transform duration-300 hover:scale-110">

                <Sunset size={34} />

              </div>

              <div>

                <p className="font-semibold uppercase tracking-widest text-sky-700">
                  Evening Darshan
                </p>

                <h3 className="mt-2 text-4xl font-bold text-stone-900">
                  {eveningOpen} – {eveningClose}
                </h3>

              </div>

            </div>

            <div className="mt-10 space-y-5">

              {eveningSchedule.map((item) => (

                <motion.div
                  key={item}
                  initial={reducedMotion ? {} : { opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: reducedMotion ? 0 : 0.1 }}
                  className="flex items-center gap-4 rounded-2xl bg-sky-50 p-4"
                >

                  <CheckCircle2
                    className="text-sky-600"
                    size={22}
                  />

                  <span className="font-medium text-stone-700">
                    {item}
                  </span>

                </motion.div>

              ))}

            </div>

          </motion.div>

        </div>

        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: reducedMotion ? 0.01 : 0.5 }}
          className="mt-14 rounded-[36px] bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 p-10 text-white shadow-2xl"
        >

          <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">

            <div className="flex items-center gap-5">

              <div className="rounded-3xl bg-white/20 p-5">

                <CalendarHeart size={34} />

              </div>

              <div>

                <h3 className="text-3xl font-bold">
                  Festival Schedule
                </h3>

                <p className="mt-2 max-w-2xl text-amber-100">
                  {festivalScheduleNote}
                </p>

              </div>

            </div>

            <div className="rounded-3xl bg-white px-8 py-5 text-center shadow-lg">

              <Clock3
                className="mx-auto text-amber-600"
                size={32}
              />

              <p className="mt-2 font-bold text-stone-900">
                Temple Open Today
              </p>

              <p className={`font-semibold ${isTempleOpen ? "text-green-600" : "text-red-600"}`}>
                {totalHours}
              </p>

            </div>

          </div>

        </motion.div>

      </div>

    </section>
  );
}
