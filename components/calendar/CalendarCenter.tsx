"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, MoonStar, ArrowRight, CalendarDays, Clock } from "lucide-react";
import { calendar } from "@/data/calendar";
import { useState, useEffect } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface CalendarCenterProps {
  nextMajorEvent?: Date;
  nextEventName?: string;
}

function CountdownCard({ eventName, eventDate }: { eventName?: string; eventDate: Date }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = eventDate.getTime() - now.getTime();

      if (difference <= 0) {
        setIsPast(true);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeout(() => setTimeLeft(calculateTimeLeft()), 0);

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [eventDate]);

  const displayEventName = eventName || "Upcoming Event";

  const timeUnits = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hours" },
    { value: timeLeft.minutes, label: "Mins" },
    { value: timeLeft.seconds, label: "Secs" },
  ];

  return (
    <div className="flex h-full flex-col justify-between rounded-[32px] border border-amber-200 bg-gradient-to-br from-amber-600 via-orange-500 to-red-500 p-8 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
          <CalendarDays size={28} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-amber-100">Next Major Event</p>
          <h3 className="text-2xl font-bold text-white">{displayEventName}</h3>
        </div>
      </div>

      {isPast ? (
        <div className="py-6 text-center">
          <p className="text-xl font-medium text-white">Event has passed</p>
          <p className="mt-2 text-amber-100">Join us for upcoming celebrations</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-4 gap-3">
            {timeUnits.map((unit) => (
              <div key={unit.label} className="flex flex-col items-center">
                <div className="flex h-16 w-full min-w-[50px] flex-col items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                  <span className="text-2xl font-bold text-white">
                    {String(unit.value).padStart(2, "0")}
                  </span>
                </div>
                <span className="mt-2 text-xs font-medium uppercase tracking-wider text-amber-100">
                  {unit.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-white/10 p-3 backdrop-blur">
            <Clock size={16} className="text-amber-100" />
            <span className="text-sm font-medium text-amber-50">
              {eventDate.toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default function CalendarCenter({ nextMajorEvent, nextEventName }: CalendarCenterProps) {
  const eventDate = nextMajorEvent ?? (() => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date;
  })();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#fff8ef] via-white to-[#fffdf8] py-24">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_40%)]" />

      <div className="relative mx-auto max-w-7xl px-6">

        <div className="mx-auto max-w-3xl text-center">

          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold tracking-wide text-amber-700">
            TEMPLE CALENDAR
          </span>

          <h2 className="mt-6 text-5xl font-bold text-stone-900">
            Sacred Calendar
          </h2>

          <p className="mt-6 text-lg leading-8 text-stone-600">
            Stay connected with Sri Matha through Ekadashi schedules,
            festival celebrations and important spiritual dates.
          </p>

        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">

          {/* Ekadashi */}

          <motion.div
            whileHover={{ y: -8 }}
            transition={{ duration: 0.25 }}
            className="group flex flex-col rounded-[32px] border border-amber-100 bg-white p-10 shadow-lg transition-all hover:shadow-2xl"
          >

            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-sky-600 text-white shadow-xl">
              <MoonStar size={36} />
            </div>

            <h3 className="mt-8 text-3xl font-bold text-stone-900">
              Ekadashi Schedule
            </h3>

            <p className="mt-4 flex-1 text-stone-600 leading-7">
              Complete Ekadashi calendar for{" "}
              <span className="font-semibold">
                {calendar.samvatsara} Samvatsara
              </span>.
            </p>

            <div className="mt-8 flex items-center justify-between">

              <div>

                <p className="text-4xl font-bold text-amber-600">
                  {calendar.ekadashi.length}
                </p>

                <p className="text-sm text-stone-500">
                  Sacred Ekadashis
                </p>

              </div>

              <Link
                href="/calendar/ekadashi"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-105"
              >
                View Schedule
                <ArrowRight size={18} />
              </Link>

            </div>

          </motion.div>

          {/* Festival Calendar */}

          <motion.div
            whileHover={{ y: -8 }}
            transition={{ duration: 0.25 }}
            className="group flex flex-col rounded-[32px] border border-amber-100 bg-white p-10 shadow-lg transition-all hover:shadow-2xl"
          >

            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-xl">
              <Calendar size={36} />
            </div>

            <h3 className="mt-8 text-3xl font-bold text-stone-900">
              Festival Calendar
            </h3>

            <p className="mt-4 flex-1 text-stone-600 leading-7">
              Major Hindu festivals celebrated at
              Sri Matha throughout the year.
            </p>

            <div className="mt-8 flex items-center justify-between">

              <div>

                <p className="text-4xl font-bold text-amber-600">
                  {calendar.festivals.length}
                </p>

                <p className="text-sm text-stone-500">
                  Major Festivals
                </p>

              </div>

              <Link
                href="/calendar/festivals"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-105"
              >
                View Calendar
                <ArrowRight size={18} />
              </Link>

            </div>

          </motion.div>

          {/* Countdown */}

          <motion.div
            whileHover={{ y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <CountdownCard eventName={nextEventName} eventDate={eventDate} />
          </motion.div>

        </div>

      </div>

    </section>
  );
}
