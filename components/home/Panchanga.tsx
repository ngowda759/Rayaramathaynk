"use client";

import { CalendarDays, Sun, MoonStar, Sunrise, Sunset } from "lucide-react";
import { motion } from "framer-motion";

const panchanga = {
  tithi: "Ekadashi",
  nakshatra: "Rohini",
  sunrise: "06:02 AM",
  sunset: "06:48 PM",
  festival: "Guru Aaradhane",
};

const items = [
  {
    title: "Tithi",
    value: panchanga.tithi,
    icon: MoonStar,
    color: "from-violet-500 to-purple-600",
  },
  {
    title: "Nakshatra",
    value: panchanga.nakshatra,
    icon: CalendarDays,
    color: "from-amber-500 to-orange-500",
  },
  {
    title: "Sunrise",
    value: panchanga.sunrise,
    icon: Sunrise,
    color: "from-orange-500 to-yellow-500",
  },
  {
    title: "Sunset",
    value: panchanga.sunset,
    icon: Sunset,
    color: "from-sky-500 to-indigo-600",
  },
];

export default function Panchanga() {
  return (
    <section className="bg-gradient-to-b from-white to-[#fff9ef] py-20">

      <div className="mx-auto max-w-7xl px-6">

        <div className="text-center">

          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            TODAY'S PANCHANGA
          </span>

          <h2 className="mt-5 text-4xl font-bold text-stone-900">
            Daily Panchanga
          </h2>

          <p className="mt-4 text-stone-600">
            Daily Hindu calendar information for devotees.
          </p>

        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

          {items.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="rounded-[30px] border border-amber-100 bg-white p-8 shadow-lg"
              >

                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} text-white`}
                >
                  <Icon size={30} />
                </div>

                <h3 className="mt-6 text-lg font-semibold text-stone-600">
                  {item.title}
                </h3>

                <p className="mt-2 text-3xl font-bold text-stone-900">
                  {item.value}
                </p>

              </motion.div>
            );
          })}

        </div>

        <div className="mt-12 rounded-[30px] bg-gradient-to-r from-amber-600 to-orange-500 p-8 text-center text-white shadow-xl">

          <Sun className="mx-auto" size={40} />

          <h3 className="mt-4 text-3xl font-bold">
            Today's Festival
          </h3>

          <p className="mt-3 text-2xl">
            {panchanga.festival}
          </p>

        </div>

      </div>

    </section>
  );
}
