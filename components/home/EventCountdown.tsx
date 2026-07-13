"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CalendarDays } from "lucide-react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface EventCountdownProps {
  eventName?: string;
  eventDate: Date;
  eventImage?: string;
}

export default function EventCountdown({
  eventName,
  eventDate,
  eventImage,
}: EventCountdownProps) {
  const displayEventName = eventName || "Upcoming Event";
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

    // Use setTimeout to avoid synchronous state update during effect
    setTimeout(() => setTimeLeft(calculateTimeLeft()), 0);

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [eventDate]);

  const timeUnits = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hours" },
    { value: timeLeft.minutes, label: "Minutes" },
    { value: timeLeft.seconds, label: "Seconds" },
  ];

  return (
    <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-amber-600 via-orange-500 to-red-500 p-8 text-white shadow-2xl">
      
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-white/20 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <CalendarDays size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-100">Next Major Event</p>
            <h3 className="text-2xl font-bold">{displayEventName}</h3>
          </div>
        </div>

        {isPast ? (
          <div className="py-6 text-center">
            <p className="text-xl font-medium">Event has passed</p>
            <p className="mt-2 text-amber-100">Join us for upcoming celebrations</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              {timeUnits.map((unit, index) => (
                <motion.div
                  key={unit.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-1 flex-col items-center"
                >
                  <div className="relative">
                    <div className="flex h-16 w-full min-w-[60px] flex-col items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm md:h-20 md:min-w-[80px]">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={unit.value}
                          initial={{ y: -10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 10, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-2xl font-bold md:text-3xl"
                        >
                          {String(unit.value).padStart(2, "0")}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>
                  <span className="mt-2 text-xs font-medium uppercase tracking-wider text-amber-100 md:text-sm">
                    {unit.label}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Event Date */}
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
    </div>
  );
}
