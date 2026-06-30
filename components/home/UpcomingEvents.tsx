"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ArrowRight,
  MapPin,
  Clock3,
} from "lucide-react";

const events = [
  {
    title: "Sri Guru Aaradhane",
    date: "14 Aug 2026",
    month: "AUG",
    countdown: "12 Days Left",
    location: "Sri Rayara Matha",
    time: "6:00 AM onwards",
    description:
      "Special poojas, Veda Parayana, Bhajans, Annadanam and cultural programmes.",
  },
  {
    title: "Hanuman Jayanti",
    date: "29 Aug 2026",
    month: "AUG",
    countdown: "27 Days Left",
    location: "Temple Premises",
    time: "7:00 AM",
    description:
      "Special Hanuman Chalisa, Abhisheka, Alankara and Maha Mangalarati.",
  },
  {
    title: "Navaratri Utsava",
    date: "03 Oct 2026",
    month: "OCT",
    countdown: "62 Days Left",
    location: "Temple Hall",
    time: "Daily",
    description:
      "Nine divine days filled with poojas, discourses, music and prasada seva.",
  },
];

export default function UpcomingEvents() {
  return (
    <section className="bg-gradient-to-b from-[#fff8ef] to-white py-24">
      <div className="mx-auto max-w-7xl px-6">

        <div className="mx-auto max-w-3xl text-center">

          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            UPCOMING EVENTS
          </span>

          <h2 className="mt-6 text-5xl font-bold text-stone-900">
            Celebrate Divine Festivals
          </h2>

          <p className="mt-6 text-lg leading-8 text-stone-600">
            Join us for upcoming spiritual celebrations,
            poojas and community gatherings.
          </p>

        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">

          {events.map((event, index) => (

            <motion.div
              key={event.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              viewport={{ once: true }}
              className="overflow-hidden rounded-[32px] border border-amber-100 bg-white shadow-lg transition hover:-translate-y-2 hover:shadow-2xl"
            >

              <div className="bg-gradient-to-r from-amber-600 to-orange-500 p-8 text-white">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-sm uppercase tracking-widest opacity-90">
                      {event.month}
                    </p>

                    <h3 className="mt-2 text-4xl font-bold">
                      {event.date.split(" ")[0]}
                    </h3>

                  </div>

                  <CalendarDays size={48} />

                </div>

              </div>

              <div className="p-8">

                <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                  {event.countdown}
                </span>

                <h3 className="mt-6 text-2xl font-bold text-stone-900">
                  {event.title}
                </h3>

                <p className="mt-5 leading-7 text-stone-600">
                  {event.description}
                </p>

                <div className="mt-6 space-y-3">

                  <div className="flex items-center gap-3">

                    <Clock3
                      className="text-amber-600"
                      size={18}
                    />

                    <span>{event.time}</span>

                  </div>

                  <div className="flex items-center gap-3">

                    <MapPin
                      className="text-amber-600"
                      size={18}
                    />

                    <span>{event.location}</span>

                  </div>

                </div>

                <Link
                  href="/events"
                  className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-105"
                >
                  View Event
                  <ArrowRight size={18} />
                </Link>

              </div>

            </motion.div>

          ))}

        </div>

      </div>
    </section>
  );
}
