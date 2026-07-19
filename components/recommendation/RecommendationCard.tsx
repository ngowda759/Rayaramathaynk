"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  RecommendationItem,
  TYPE_ICONS,
  REASON_LABELS,
} from "@/types/recommendation";

interface RecommendationCardProps {
  item: RecommendationItem;
  index: number;
  variant?: "default" | "compact";
}

export default function RecommendationCard({
  item,
  index,
  variant = "default",
}: RecommendationCardProps) {
  const icon = TYPE_ICONS[item.type];

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <Link
          href={item.url}
          className="group flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 transition-all hover:border-amber-300 hover:shadow-md"
        >
          <span className="text-2xl">{icon}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-stone-900 truncate text-sm">
              {item.title}
            </h4>
            <p className="text-xs text-stone-500 capitalize">
              {item.type}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-stone-400 transition-transform group-hover:translate-x-1" />
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link
        href={item.url}
        className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:border-amber-300 hover:shadow-lg"
      >
        {/* Image/Icon */}
        <div className="relative h-32 bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-5xl">{icon}</span>
          )}
          
          {/* Type badge */}
          <div className="absolute top-3 left-3">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-stone-700 capitalize shadow-sm">
              {item.type}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-stone-900 line-clamp-2 group-hover:text-amber-600 transition-colors">
            {item.title}
          </h3>
          
          {item.description && (
            <p className="mt-2 text-sm text-stone-500 line-clamp-2">
              {item.description}
            </p>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600">
              {REASON_LABELS[item.reason]}
            </span>
            <ArrowRight className="h-4 w-4 text-stone-400 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
