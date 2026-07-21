"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Quote, QuoteCategory, QUOTE_CATEGORIES } from "@/types/quote";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, Star, Calendar, Tag } from "lucide-react";
import Link from "next/link";

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

export const quoteColumns: ColumnDef<Quote>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <div className="max-w-xs">
        <p className="truncate font-medium">{row.original.title}</p>
        {row.original.verseNumber && (
          <p className="text-xs text-muted-foreground">
            Verse {row.original.verseNumber}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      const category = row.original.category as QuoteCategory;
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
    accessorKey: "language",
    header: "Language",
    cell: ({ row }) => (
      <span className="uppercase">{row.original.language}</span>
    ),
  },
  {
    accessorKey: "featured",
    header: "Featured",
    cell: ({ row }) =>
      row.original.featured ? (
        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          row.original.active
            ? "bg-green-100 text-green-800"
            : "bg-gray-100 text-gray-800"
        }`}
      >
        {row.original.active ? "Active" : "Inactive"}
      </span>
    ),
  },
  {
    accessorKey: "festivalNames",
    header: "Festivals",
    cell: ({ row }) => {
      const festivals = row.original.festivalNames || [];
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
    accessorKey: "weekdayOnly",
    header: "Weekday",
    cell: ({ row }) => {
      if (row.original.weekdayOnly === null || row.original.weekdayOnly === undefined) {
        return <span className="text-muted-foreground">Any</span>;
      }
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return <span>{days[row.original.weekdayOnly]}</span>;
    },
  },
  {
    accessorKey: "stats.viewCount",
    header: "Views",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.stats?.viewCount || 0}
      </span>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.updatedAt)}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/quotes/${row.original.id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/quotes/${row.original.id}/edit`}>
            <Edit className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm(`Delete "${row.original.title}"?`)) {
              // Handle delete
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
  },
];
