"use client";

import { CrudColumn } from "@/types/crud";
import { Quote, QuoteCategory } from "@/types/quote";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

const categoryColors: Record<QuoteCategory, string> = {
  raghavendra_stotra: "bg-amber-100 text-amber-800 border-amber-200",
  mangalashtakam: "bg-purple-100 text-purple-800 border-purple-200",
  guru_vandana: "bg-blue-100 text-blue-800 border-blue-200",
  authentic_teachings: "bg-green-100 text-green-800 border-green-200",
  devotional_sayings: "bg-pink-100 text-pink-800 border-pink-200",
  madhwa_philosophy: "bg-orange-100 text-orange-800 border-orange-200",
};

const categoryLabels: Record<QuoteCategory, string> = {
  raghavendra_stotra: "Stotra",
  mangalashtakam: "Mangalashtakam",
  guru_vandana: "Guru Vandana",
  authentic_teachings: "Teachings",
  devotional_sayings: "Devotional",
  madhwa_philosophy: "Philosophy",
};

export const quoteColumns: CrudColumn<Quote>[] = [
  {
    key: "title",
    header: "Title",
    width: "250px",
    render: (row) => (
      <div className="max-w-xs">
        <p className="truncate font-medium">{row.title}</p>
        {row.verseNumber && (
          <p className="text-xs text-muted-foreground">
            Verse {row.verseNumber}
          </p>
        )}
      </div>
    ),
  },
  {
    key: "category",
    header: "Category",
    render: (row) => {
      const category = row.category as QuoteCategory;
      return (
        <Badge
          variant="outline"
          className={categoryColors[category] || "bg-gray-100"}
        >
          {categoryLabels[category] || category}
        </Badge>
      );
    },
  },
  {
    key: "language",
    header: "Language",
    render: (row) => (
      <span className="uppercase">{row.language}</span>
    ),
  },
  {
    key: "featured",
    header: "Featured",
    render: (row) =>
      row.featured ? (
        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "active",
    header: "Status",
    render: (row) => (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          row.active
            ? "bg-green-100 text-green-800"
            : "bg-gray-100 text-gray-800"
        }`}
      >
        {row.active ? "Active" : "Inactive"}
      </span>
    ),
  },
  {
    key: "festivalNames",
    header: "Festivals",
    render: (row) => {
      const festivals = row.festivalNames || [];
      if (festivals.length === 0) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {festivals.slice(0, 2).map((festival) => (
            <Badge key={festival} variant="secondary" className="text-xs">
              {festival.replace(/_/g, " ")}
            </Badge>
          ))}
          {festivals.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{festivals.length - 2}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    key: "weekdayOnly",
    header: "Weekday",
    render: (row) => {
      if (row.weekdayOnly === null || row.weekdayOnly === undefined) {
        return <span className="text-muted-foreground">Any</span>;
      }
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return <span>{days[row.weekdayOnly]}</span>;
    },
  },
  {
    key: "stats.viewCount",
    header: "Views",
    render: (row) => (
      <span className="tabular-nums">
        {row.stats?.viewCount || 0}
      </span>
    ),
  },
];
