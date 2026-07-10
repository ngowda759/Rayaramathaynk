"use client";

import {
  Bell,
  CalendarDays,
  Clock3,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const cards = [
  {
    title: "Temple Status",
    value: "🟢 OPEN NOW",
    description: "Morning Darshan • 6:00 AM - 1:00 PM",
    icon: Clock3,
    color: "from-green-500 to-emerald-600",
  },
  {
    title: "Today's Seva",
    value: "Maha Pooja",
    description: "Starts at 10:30 AM",
    icon: Bell,
    color: "from-amber-500 to-orange-500",
  },
  {
    title: "Upcoming Festival",
    value: "Guru Aaradhane",
    description: "12 Days Remaining",
    icon: CalendarDays,
    color: "from-rose-500 to-pink-500",
  },
];

export default function TempleInfo() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#fffaf4] via-white to-[#fff8ef] py-24">

      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "url('/images/Hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">

        <div className="mx-auto max-w-3xl text-center">

          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            TEMPLE INFORMATION
          </span>

          <h2 className="mt-6 text-5xl font-bold text-stone-900">
            Experience Divine Peace
          </h2>

          <p className="mt-6 text-lg leading-8 text-stone-600">
            Sri Rayara Matha is a sacred place of devotion,
            daily poojas, spiritual learning and community
            service dedicated to Sri Raghavendra Swamy.
          </p>

        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 xl:grid-cols-3">

          {cards.map((card, index) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.15,
                }}
                viewport={{ once: true }}
                className="group rounded-3xl border border-amber-100 bg-white/80 p-8 shadow-lg backdrop-blur transition-all duration-300 hover:-translate-y-3 hover:shadow-2xl"
              >

                <div
                  className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${card.color} text-white shadow-lg`}
                >
                  <Icon size={30} />
                </div>

                <h3 className="mt-7 text-xl font-bold text-stone-900">
                  {card.title}
                </h3>

                <p className="mt-3 text-2xl font-bold text-amber-700">
                  {card.value}
                </p>

                <p className="mt-4 leading-7 text-stone-600">
                  {card.description}
                </p>

              </motion.div>
            );
          })}

        </div>

        <div className="mt-20 rounded-[32px] bg-gradient-to-r from-amber-600 to-orange-500 p-10 text-white shadow-2xl">

          <div className="grid items-center gap-8 lg:grid-cols-2">

            <div>

              <h3 className="text-4xl font-bold">
                Visit Sri Rayara Matha
              </h3>

              <p className="mt-5 text-lg leading-8 text-amber-100">
                Join us for daily poojas, special sevas,
                Guru Aaradhane celebrations and Annadanam.
                Experience divine blessings in a peaceful
                spiritual atmosphere.
              </p>

            </div>

            <div className="flex justify-start gap-4 lg:justify-end">

              <Link
                href="/sevas"
                className="rounded-2xl bg-white px-8 py-4 font-semibold text-amber-700 transition hover:scale-105"
              >
                Book Seva
              </Link>

              <Link
                href="/about"
                className="flex items-center gap-2 rounded-2xl border border-white/40 px-8 py-4 font-semibold transition hover:bg-white/10"
              >
                Learn More
                <ArrowRight size={18} />
              </Link>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}
