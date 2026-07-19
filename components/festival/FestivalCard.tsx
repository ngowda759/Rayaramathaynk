"use client";

import React from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Star, ChevronRight } from "lucide-react";
import { Festival, calculateCountdown, getSeasonColor } from "@/types/festival";

interface FestivalCardProps {
  festival: Festival;
  index: number;
}

export default function FestivalCard({ festival, index }: FestivalCardProps) {
  const countdown = calculateCountdown(festival);
  const seasonColor = getSeasonColor(festival.season);
  const isPast = countdown.isPast;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`group relative overflow-hidden rounded-2xl border bg-white transition-all duration-300 hover:shadow-lg ${
        festival.isMajor
          ? "border-amber-300 shadow-amber-100"
          : "border-stone-200"
      }`}
    >
      {/* Seasonal indicator */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${seasonColor}`} />

      {/* Major badge */}
      {festival.isMajor && (
        <div className="absolute -right-8 top-6 rotate-45 bg-amber-500 px-8 py-1 text-xs font-semibold text-white shadow-sm">
          Major
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-stone-900">{festival.name}</h3>
            {festival.deity && (
              <p className="mt-1 text-sm text-amber-600">Honoring {festival.deity}</p>
            )}
          </div>
          {festival.isMajor && (
            <Star className="h-5 w-5 flex-shrink-0 text-amber-500" />
          )}
        </div>

        {/* Date */}
        <div className="mt-4 flex items-center gap-2 text-stone-600">
          <Calendar className="h-4 w-4 text-stone-400" />
          <span className="text-sm">
            {new Date(festival.date).toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
          <span className="text-stone-300">•</span>
          <span className="text-sm capitalize text-stone-500">{festival.dayOfWeek}</span>
        </div>

        {/* Description */}
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-stone-600">
          {festival.description}
        </p>

        {/* Countdown or Status */}
        <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
          {isPast ? (
            <span className="text-sm text-stone-400">Celebrated</span>
          ) : countdown.isToday ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Today!
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-amber-600">
              <Clock className="h-4 w-4" />
              {countdown.daysRemaining} day
              {countdown.daysRemaining !== 1 ? "s" : ""} away
            </span>
          )}

          <ChevronRight className="h-5 w-5 text-stone-400 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </motion.div>
  );
}
