"use client";

import { CalendarDays, MoonStar } from "lucide-react";
import { calendar } from "@/data/calendar";

function getNextEkadashi() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = calendar.ekadashi.find((item) => {
    const eventDate = new Date(item.date);
    eventDate.setHours(0, 0, 0, 0);

    return eventDate >= today;
  });

  return upcoming ?? null;
}

function daysRemaining(date: string) {
  const today = new Date();
  const eventDate = new Date(date);

  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);

  return Math.ceil(
    (eventDate.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function NextEkadashiCard() {
  const next = getNextEkadashi();

  if (!next) return null;

  const remaining = daysRemaining(next.date);

  const badgeColor =
    remaining <= 7
      ? "bg-green-100 text-green-700"
      : remaining <= 30
      ? "bg-amber-100 text-amber-700"
      : "bg-sky-100 text-sky-700";

  return (
    <div className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-8 shadow-sm">

      <div className="flex items-center gap-4">

        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 text-white shadow-lg">
          <MoonStar size={32} />
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">
            Next Upcoming
          </p>

          <h2 className="text-3xl font-bold text-stone-900">
            Ekadashi
          </h2>
        </div>

      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">

        <div>

          <p className="text-sm text-stone-500">
            Date
          </p>

          <p className="mt-2 text-xl font-bold text-stone-900">
            {formatDate(next.date)}
          </p>

        </div>

        <div>

          <p className="text-sm text-stone-500">
            Day
          </p>

          <p className="mt-2 text-xl font-bold text-stone-900">
            {next.day}
          </p>

        </div>

        <div>

          <p className="text-sm text-stone-500">
            Remaining
          </p>

          <span
            className={`mt-2 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${badgeColor}`}
          >
            <CalendarDays size={16} className="mr-2" />
            {remaining} Days
          </span>

        </div>

      </div>

    </div>
  );
}
