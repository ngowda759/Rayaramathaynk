"use client";

import {
  Clock3,
  CalendarDays,
  Bell,
  Sun,
} from "lucide-react";

const cards = [
  {
    title: "Temple Status",
    value: "OPEN NOW",
    description: "Morning Darshan • 6:00 AM - 1:00 PM",
    icon: Sun,
    color: "bg-green-100 text-green-700",
  },
  {
    title: "Today's Seva",
    value: "Maha Pooja",
    description: "Starts at 10:30 AM",
    icon: Bell,
    color: "bg-amber-100 text-amber-700",
  },
  {
    title: "Temple Timings",
    value: "6 AM - 8:30 PM",
    description: "Closed between 1 PM - 4:30 PM",
    icon: Clock3,
    color: "bg-blue-100 text-blue-700",
  },
  {
    title: "Upcoming Festival",
    value: "Guru Aradhana",
    description: "Only 12 Days Left",
    icon: CalendarDays,
    color: "bg-rose-100 text-rose-700",
  },
];

export default function TempleInfo() {
  return (
    <section className="bg-stone-50 py-20">
      <div className="mx-auto max-w-7xl px-6">

        <div className="mb-12 text-center">
          <p className="text-amber-600 font-semibold uppercase tracking-widest">
            Temple Information
          </p>

          <h2 className="mt-3 text-4xl font-bold text-gray-900">
            Everything You Need Today
          </h2>

          <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
            Stay updated with temple timings, today's sevas,
            announcements and upcoming spiritual events.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">

          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="rounded-3xl bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
              >
                <div
                  className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${card.color}`}
                >
                  <Icon size={28} />
                </div>

                <h3 className="mt-6 text-lg font-semibold text-gray-900">
                  {card.title}
                </h3>

                <p className="mt-3 text-2xl font-bold text-amber-700">
                  {card.value}
                </p>

                <p className="mt-3 text-gray-600">
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
