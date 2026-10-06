"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CalendarDays, Sparkles } from "lucide-react";
import { Festival, calculateCountdown } from "@/types/festival";

interface FestivalCountdownProps {
  festival: Festival;
}

export default function FestivalCountdown({ festival }: FestivalCountdownProps) {
  const [countdown, setCountdown] = useState(() => calculateCountdown(festival));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Setting mounted to true indicates the component has hydration and we can render safely
    const timeoutId = setTimeout(() => {
        setMounted(true);
    }, 0);

    const timerId = setInterval(() => {
      setCountdown(calculateCountdown(festival));
    }, 1000);

    return () => {
        clearTimeout(timeoutId);
        clearInterval(timerId);
    };
  }, [festival]);

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  const { daysRemaining, hoursRemaining, minutesRemaining, isPast, isToday } = countdown;

  const timeUnits = [
    { value: daysRemaining, label: "Days" },
    { value: hoursRemaining, label: "Hours" },
    { value: minutesRemaining, label: "Minutes" },
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
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-amber-100">Upcoming Festival</p>
              {festival.isMajor && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-semibold text-amber-900 uppercase tracking-wider">
                  <Sparkles className="h-3 w-3" />
                  Major
                </span>
              )}
            </div>
            <h3 className="text-2xl font-bold">{festival.name}</h3>
          </div>
        </div>

        {isPast ? (
          <div className="py-6 text-center">
            <p className="text-xl font-medium">Festival has passed</p>
            <p className="mt-2 text-amber-100">Join us for upcoming celebrations</p>
          </div>
        ) : isToday ? (
          <div className="py-6 text-center">
            <p className="text-xl font-medium">Today is the Day!</p>
            <p className="mt-2 text-amber-100">Join us in celebrating {festival.name}</p>
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
                {new Date(festival.date).toLocaleDateString("en-IN", {
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
