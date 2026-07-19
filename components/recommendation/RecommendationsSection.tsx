"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, RefreshCw, ChevronRight } from "lucide-react";
import RecommendationCard from "./RecommendationCard";
import {
  RecommendationItem,
  RecommendationConfig,
} from "@/types/recommendation";

interface RecommendationsSectionProps {
  title?: string;
  subtitle?: string;
  config?: Partial<RecommendationConfig>;
  variant?: "grid" | "list" | "compact";
  maxItems?: number;
  showRefresh?: boolean;
}

export default function RecommendationsSection({
  title = "Recommended for You",
  subtitle,
  config,
  variant = "grid",
  maxItems = 6,
  showRefresh = false,
}: RecommendationsSectionProps) {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommendations");
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      
      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      setError("Unable to load recommendations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleRefresh = () => {
    fetchRecommendations();
  };

  if (isLoading) {
    return (
      <section className="py-12">
        <SectionHeader title={title} subtitle={subtitle} />
        <div className={variant === "grid" ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
          {Array.from({ length: maxItems }).map((_, i) => (
            <LoadingSkeleton key={i} variant={variant} />
          ))}
        </div>
      </section>
    );
  }

  if (error || recommendations.length === 0) {
    return (
      <section className="py-12">
        <SectionHeader title={title} subtitle={subtitle} />
        <EmptyState onRefresh={showRefresh ? handleRefresh : undefined} />
      </section>
    );
  }

  const displayItems = recommendations.slice(0, maxItems);

  return (
    <section className="py-12">
      <div className="flex items-center justify-between mb-8">
        <SectionHeader title={title} subtitle={subtitle} />
        {showRefresh && (
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        )}
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={variant === "grid" ? {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
          }
        } : undefined}
        className={
          variant === "grid"
            ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            : variant === "compact"
            ? "space-y-3"
            : "space-y-4"
        }
      >
        {displayItems.map((item, index) => (
          <RecommendationCard
            key={item.id}
            item={item}
            index={index}
            variant={variant === "compact" ? "compact" : "default"}
          />
        ))}
      </motion.div>

      {/* View More */}
      <div className="mt-8 text-center">
        <a
          href="/knowledge"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white transition-all hover:bg-amber-600 hover:shadow-lg"
        >
          Explore More
          <ChevronRight className="h-5 w-5" />
        </a>
      </div>
    </section>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-6 w-6 text-amber-500" />
        <h2 className="text-2xl font-bold text-stone-900">{title}</h2>
      </div>
      {subtitle && <p className="text-stone-600">{subtitle}</p>}
    </div>
  );
}

function LoadingSkeleton({ variant }: { variant: string }) {
  if (variant === "compact") {
    return (
      <div className="animate-pulse rounded-xl border border-stone-200 bg-white p-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-stone-200" />
          <div className="flex-1">
            <div className="h-4 w-3/4 rounded bg-stone-200" />
            <div className="mt-1 h-3 w-1/2 rounded bg-stone-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="h-32 bg-stone-200" />
      <div className="p-4">
        <div className="h-5 w-3/4 rounded bg-stone-200" />
        <div className="mt-2 h-4 w-full rounded bg-stone-200" />
        <div className="mt-1 h-4 w-2/3 rounded bg-stone-200" />
      </div>
    </div>
  );
}

function EmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-12 text-center">
      <Sparkles className="mx-auto h-12 w-12 text-stone-300" />
      <h3 className="mt-4 text-lg font-medium text-stone-900">
        No recommendations yet
      </h3>
      <p className="mt-2 text-stone-500">
        Start exploring content to get personalized recommendations
      </p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      )}
    </div>
  );
}
