"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Calendar, Star, Sparkles } from "lucide-react";
import Link from "next/link";
import { Festival, calculateCountdown, getSeasonColor } from "@/types/festival";

interface FeaturedFestivalProps {
  festival: Festival;
}

export default function FeaturedFestival({ festival }: FeaturedFestivalProps) {
  const [countdown, setCountdown] = useState(calculateCountdown(festival));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(calculateCountdown(festival));
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [festival]);

  const seasonColor = getSeasonColor(festival.season);
  const isPast = countdown.isPast;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl"
    >
      {/* Background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${seasonColor} opacity-90`} />
      
      {/* Decorative elements */}
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      
      <div className="relative p-8 md:p-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          {/* Festival Info */}
          <div className="flex-1">
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white backdrop-blur">
                <Star className="h-4 w-4" />
                Featured Festival
              </span>
              {festival.isMajor && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 px-4 py-1.5 text-sm font-semibold text-amber-900">
                  <Sparkles className="h-4 w-4" />
                  Major Festival
                </span>
              )}
            </div>

            <h2 className="text-4xl font-bold text-white md:text-5xl">
              {festival.name}
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>
                  {new Date(festival.date).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              {festival.deity && (
                <div className="flex items-center gap-2">
                  <span className="text-white/60">•</span>
                  <span>Honoring: {festival.deity}</span>
                </div>
              )}
            </div>

            <p className="mt-6 text-lg leading-relaxed text-white/80 max-w-2xl">
              {festival.description}
            </p>

            {festival.significance && (
              <div className="mt-6 rounded-xl bg-white/10 p-4 backdrop-blur">
                <p className="text-sm font-medium text-white/90">
                  <span className="text-white">Significance:</span> {festival.significance}
                </p>
              </div>
            )}
          </div>

          {/* Countdown */}
          <div className="lg:w-80">
            <div className="rounded-2xl bg-white/10 backdrop-blur p-6">
              {isPast ? (
                <div className="text-center">
                  <div className="text-6xl">🎉</div>
                  <p className="mt-4 text-xl font-semibold text-white">
                    Celebrated!
                  </p>
                  <p className="mt-2 text-white/70">
                    This festival has passed for this year
                  </p>
                </div>
              ) : countdown.isToday ? (
                <div className="text-center">
                  <div className="text-6xl">✨</div>
                  <p className="mt-4 text-xl font-semibold text-white">
                    Today is the Day!
                  </p>
                  <p className="mt-2 text-white/70">
                    Join us in celebrating {festival.name}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-white/80 mb-4">
                    <Clock className="h-5 w-5" />
                    <span className="text-sm font-medium">Countdown</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <CountdownUnit value={countdown.daysRemaining} label="Days" />
                    <CountdownUnit value={countdown.hoursRemaining} label="Hours" />
                    <CountdownUnit value={countdown.minutesRemaining} label="Min" />
                  </div>
                </>
              )}
            </div>

            <Link
              href="/events"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-stone-900 transition-all hover:bg-white/90 hover:shadow-lg"
            >
              View All Events
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-white">
        {value.toString().padStart(2, "0")}
      </div>
      <div className="text-xs font-medium text-white/60 uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
