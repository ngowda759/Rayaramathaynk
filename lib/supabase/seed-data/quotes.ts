/**
 * Fresh Supabase-native starter content for the devotional quote engine.
 *
 * The rows come from the repository's own `seed/quotes-seed-data.json` — a checked-in
 * content file, not a Firestore export. Every quote keeps its stable `slug`, so a
 * re-run upserts onto the same row instead of creating a duplicate.
 */

import quotesSeed from "../../../seed/quotes-seed-data.json";
import type { SeedRecord } from "./content";

interface RawQuote {
  slug: string;
  title: string;
  category: string;
  priority: number;
  language: string;
  content: Record<string, unknown>;
  source: string;
  author?: string;
  verseNumber?: number;
  tags?: string[];
  active?: boolean;
  featured?: boolean;
  festivalOnly?: boolean;
  festivalNames?: string[];
  weekdayOnly?: number | null;
  displayWeight?: number;
}

export const QUOTE_SEEDS: SeedRecord[] = (quotesSeed as RawQuote[]).map((q) => ({
  conflict: "slug",
  row: {
    slug: q.slug,
    title: q.title,
    category: q.category,
    priority: q.priority ?? 5,
    language: q.language ?? "en",
    content: q.content ?? {},
    source: q.source ?? "",
    author: q.author ?? null,
    verse_number: q.verseNumber ?? null,
    tags: q.tags ?? [],
    active: q.active ?? true,
    featured: q.featured ?? false,
    festival_only: q.festivalOnly ?? false,
    festival_names: q.festivalNames ?? [],
    weekday_only: q.weekdayOnly ?? null,
    display_weight: q.displayWeight ?? 1,
    stats: { viewCount: 0 },
    created_by: "seed",
  },
}));
