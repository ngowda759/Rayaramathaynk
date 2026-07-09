"use client";

import { useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { ArrowRight, ChevronDown } from "lucide-react";
import Image from "next/image";

type GalleryItem = {
  id: string;
  type: "image" | "video";
  src: string;
  alt: string;
  title: string;
  year?: string;
};

interface Props {
  items: GalleryItem[];
}

type GalleryFilter = "all" | "photos" | "videos";

export default function GalleryGrid({ items }: Props) {
  const [filter, setFilter] = useState<GalleryFilter>("all");

  // Get unique years from items
  const years = [...new Set(items.map((item) => item.year).filter(Boolean))].sort().reverse();
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const filteredItems = items.filter((item) => {
    // Filter by type
    if (filter === "photos" && item.type !== "image") return false;
    if (filter === "videos" && item.type !== "video") return false;
    
    // Filter by year
    if (selectedYear !== "all" && item.year !== selectedYear) return false;
    
    return true;
  });

  return (
    <section className="space-y-12 py-16">
      <div className="space-y-4 text-center">
        <SectionHeading
          title="Temple Gallery"
          subtitle="A visual journey through the spiritual life and ceremonies at our temple."
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-4">
        {/* Type Filter */}
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as GalleryFilter)}
            className="appearance-none rounded-2xl border-2 border-amber-300 bg-white px-6 py-3 pr-10 font-semibold text-stone-700 shadow-sm transition hover:border-amber-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 cursor-pointer"
          >
            <option value="all">All Media</option>
            <option value="photos">Photos</option>
            <option value="videos">Videos</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-600" />
        </div>

        {/* Year Filter */}
        {years.length > 0 && (
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none rounded-2xl border-2 border-amber-300 bg-white px-6 py-3 pr-10 font-semibold text-stone-700 shadow-sm transition hover:border-amber-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 cursor-pointer"
            >
              <option value="all">All Years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-amber-600" />
          </div>
        )}
      </div>

      {/* Gallery Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-stone-50 p-12 text-center text-stone-700 shadow-sm">
          No {filter === "photos" ? "photos" : filter === "videos" ? "videos" : "items"} found.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"
            >
              <div className="relative h-72 w-full bg-black">
                {item.type === "image" ? (
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition duration-500 hover:scale-105"
                  />
                ) : (
                  <iframe
                    src={item.src}
                    title={item.title}
                    className="h-full w-full"
                    loading="lazy"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
                {item.type === "video" && (
                  <div className="absolute top-3 right-3 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                    VIDEO
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-stone-900">
                    {item.title}
                  </h3>
                  {item.year && (
                    <span className="text-sm font-medium text-amber-600">
                      {item.year}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {item.alt}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
