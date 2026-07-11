"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, MapPin } from "lucide-react";
import { TempleEvent } from "@/types/event";
import { eventService } from "@/services/event.service";

export default function EventDetailPage() {
  const params = useParams();
  const [event, setEvent] = useState<TempleEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvent() {
      try {
        const id = params.id as string;
        const data = await eventService.getEvent(id);
        setEvent(data);
      } catch {
        setError("Event not found");
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadEvent();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          <p className="mt-5 text-stone-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-stone-900">Event Not Found</h1>
          <p className="mt-4 text-stone-600">The event you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href="/events"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white transition hover:bg-amber-700"
          >
            <ArrowLeft size={18} />
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const startDate = event.startDate.toDate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffaf3] to-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-500 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <Link
            href="/events"
            className="mb-8 inline-flex items-center gap-2 text-white/80 transition hover:text-white"
          >
            <ArrowLeft size={18} />
            Back to Events
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <span className="mb-4 inline-block rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white">
                {event.category || "Special Event"}
              </span>
              <h1 className="mt-4 text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                {event.title}
              </h1>
            </div>

            <div className="mt-8 rounded-3xl bg-white/10 p-8 text-white backdrop-blur md:mt-0">
              <div className="flex items-center gap-4">
                <CalendarDays size={48} />
                <div>
                  <p className="text-sm uppercase tracking-widest opacity-80">
                    {startDate.toLocaleDateString("en-US", { weekday: "long" })}
                  </p>
                  <p className="text-4xl font-bold">
                    {startDate.getDate()}
                  </p>
                  <p className="text-lg">
                    {startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Event Details */}
        <div className="mb-12 rounded-3xl border border-amber-100 bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-2xl font-bold text-stone-900">Event Details</h2>
          
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-amber-100 p-4">
                <CalendarDays className="text-amber-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-stone-500">Date</p>
                <p className="font-semibold text-stone-900">
                  {startDate.toLocaleDateString("en-US", { 
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })}
                </p>
              </div>
            </div>

            {event.startTime && (
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-amber-100 p-4">
                  <Clock3 className="text-amber-600" size={24} />
                </div>
                <div>
                  <p className="text-sm text-stone-500">Time</p>
                  <p className="font-semibold text-stone-900">
                    {event.startTime}
                    {event.endTime && ` - ${event.endTime}`}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-amber-100 p-4">
                <MapPin className="text-amber-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-stone-500">Location</p>
                <p className="font-semibold text-stone-900">{event.location}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mb-12 rounded-3xl border border-amber-100 bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-2xl font-bold text-stone-900">About This Event</h2>
          <div className="prose prose-stone max-w-none">
            <p className="text-lg leading-8 text-stone-600 whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-3xl bg-gradient-to-r from-amber-600 to-orange-500 p-8 text-center text-white">
          <h3 className="text-2xl font-bold">Interested in this Event?</h3>
          <p className="mt-4 text-amber-100">
            Visit the temple or contact us for more information about participating.
          </p>
          <Link
            href="/donation"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-amber-600 transition hover:scale-105"
          >
            Make a Donation
          </Link>
        </div>
      </div>
    </div>
  );
}
