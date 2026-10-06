"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import EventGrid from "@/components/events/EventGrid";
import FestivalCountdownWrapper from "@/components/festival/FestivalCountdownWrapper";

export default function UpcomingEvents() {
  return (
    <section className="bg-gradient-to-b from-[#fff8ef] to-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
                UPCOMING EVENTS
              </span>

              <h2 className="mt-6 text-4xl lg:text-5xl font-bold text-stone-900">
                Celebrate Divine Festivals
              </h2>

              <p className="mt-6 text-lg leading-8 text-stone-600">
                Join us for upcoming spiritual celebrations,
                poojas, utsavas and community gatherings at
                Sri Rayara Math.
              </p>
            </motion.div>

            <div className="mt-12">
              <EventGrid limit={4} />
            </div>

            <div className="mt-12">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-8 py-4 font-semibold text-white transition hover:scale-105"
              >
                View All Events
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-4 w-full">
             <FestivalCountdownWrapper />
          </div>
        </div>
      </div>
    </section>
  );
}
