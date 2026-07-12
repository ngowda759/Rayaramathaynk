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
    <div className="overflow-hidden rounded-[32px] border border-amber-100 bg-white shadow-lg transition hover:-translate-y-2 hover:shadow-2xl">

      <div className="bg-gradient-to-r from-amber-600 to-orange-500 p-8 text-white">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-sm uppercase tracking-widest">
              {month}
            </p>

            <h3 className="mt-2 text-4xl font-bold">
              {start.getDate()}
            </h3>

          </div>

          <CalendarDays size={48} />

        </div>

      </div>

      <div className="p-8">

        <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
          {daysLeft(start)} Days Left
        </span>

        <h3 className="mt-6 text-2xl font-bold">
          {event.title}
        </h3>

        <p className="mt-5 line-clamp-3 leading-7 text-stone-600">
          {event.description}
        </p>

        <div className="mt-6 space-y-3">

          {event.startTime && (
            <div className="flex items-center gap-3">
              <Clock3
                className="text-amber-600"
                size={18}
              />
              {event.startTime}
            </div>
          )}

          <div className="flex items-center gap-3">
            <MapPin
              className="text-amber-600"
              size={18}
            />
            {event.location}
          </div>

        </div>

        <Link
          href={`/events/${event.id}`}
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-105"
        >
          View Event
          <ArrowRight size={18} />
        </Link>

      </div>

    </div>
  );
}
