"use client";

import Link from "next/link";
import { CalendarDays, Clock3, MapPin, ArrowRight } from "lucide-react";
import { TempleEvent } from "@/types/event";

interface Props {
  event: TempleEvent;
}

function toDate(date: any): Date {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  if (typeof date === 'number') return new Date(date);
  if (date.toDate && typeof date.toDate === 'function') return date.toDate();
  return new Date(0);
}

function daysLeft(date: Date) {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const eventDate = new Date(date);

  eventDate.setHours(0, 0, 0, 0);

  const diff =
    eventDate.getTime() - today.getTime();

  return Math.max(
    0,
    Math.ceil(diff / (1000 * 60 * 60 * 24))
  );
}

export default function EventCard({
  event,
}: Props) {
  const start = toDate(event.startDate);

  const month = start
    .toLocaleString("en-US", {
      month: "short",
    })
    .toUpperCase();

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-lg transition hover:-translate-y-2 hover:shadow-2xl">

      <div className="bg-gradient-to-r from-amber-600 to-orange-500 p-4 text-white">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-xs uppercase tracking-widest">
              {month}
            </p>

            <h3 className="mt-1 text-2xl font-bold">
              {start.getDate()}
            </h3>

          </div>

          <CalendarDays size={28} />

        </div>

      </div>

      <div className="p-4">

        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          {daysLeft(start)} Days Left
        </span>

        <h3 className="mt-4 text-lg font-bold">
          {event.title}
        </h3>

        <p className="mt-3 line-clamp-2 text-sm leading-5 text-stone-600">
          {event.description}
        </p>

        <div className="mt-4 space-y-2">

          {event.startTime && (
            <div className="flex items-center gap-2 text-sm">
              <Clock3
                className="text-amber-600"
                size={14}
              />
              {event.startTime}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <MapPin
              className="text-amber-600"
              size={14}
            />
            {event.location}
          </div>

        </div>

        <Link
          href={`/events/${event.id}`}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:scale-105"
        >
          View Event
          <ArrowRight size={14} />
        </Link>

      </div>

    </div>
  );
}
