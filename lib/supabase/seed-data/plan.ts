/**
 * The complete fresh-initialization plan.
 *
 * A single ordered list of `{ table, conflict, rows, insertOnly }` operations that
 * `scripts/seed-fresh-supabase.ts` applies. It is also imported by the seed tests, so
 * the tests assert the same plan production uses rather than a copy of it.
 *
 * `insertOnly` marks the tables that hold devotee-supplied or mutable production data
 * (`page_views`, `daily_page_stats`, `intent_metrics`, `intent_feedback`, `chat_metrics`).
 * Those are created but never seeded with rows — seeding them would fabricate analytics.
 * They are listed so the initialization can assert the tables exist.
 */

import { SETTINGS_DOCUMENT_SEEDS } from "./settings-documents";
import {
  ANNOUNCEMENT_SEEDS,
  DAILY_POOJA_SEEDS,
  DONATION_CAMPAIGN_SEEDS,
  GALLERY_ALBUM_SEEDS,
  GALLERY_MEDIA_SEEDS,
  MEMBER_SEEDS,
  SITE_SETTINGS_SEED,
  SOCIAL_LINKS_SEED,
  TEMPLE_AREA_SEEDS,
  TESTIMONIAL_SEEDS,
  VOLUNTEER_SEEDS,
  type SeedRecord,
} from "./content";
import { QUOTE_SEEDS } from "./quotes";

export interface SeedOperation {
  table: string;
  /** Unique column the upsert conflicts on. */
  conflict: string;
  rows: Record<string, unknown>[];
  /** True when the table must exist but must never receive seeded rows. */
  insertOnly?: boolean;
  /**
   * How to treat a table that already holds rows.
   *
   * - `"empty"` — seed the starter rows only when the table is empty. This is the
   *   default for content tables, whose rows are owner-curated: a database that
   *   already has rows (for example a project that previously imported its own
   *   content under different identifiers) is left exactly as it is, so a re-run can
   *   never add a parallel starter copy next to the real rows.
   * - `"always"` — upsert each row on its conflict key (`ON CONFLICT DO NOTHING`).
   *   This is correct for `settings_documents`, where the conflict target
   *   (`document_key`) is the true natural key: a missing document is added and an
   *   existing one is never touched.
   */
  seedWhen?: "empty" | "always";
}

function op(
  table: string,
  records: SeedRecord[],
  seedWhen: "empty" | "always" = "empty"
): SeedOperation {
  return {
    table,
    conflict: records[0]?.conflict ?? "id",
    rows: records.map((r) => r.row),
    seedWhen,
  };
}

export const SEED_PLAN: SeedOperation[] = [
  op("site_settings", [SITE_SETTINGS_SEED]),
  op("social_links", [SOCIAL_LINKS_SEED]),
  op("announcements", ANNOUNCEMENT_SEEDS),
  op("daily_poojas", DAILY_POOJA_SEEDS),
  op("donation_campaigns", DONATION_CAMPAIGN_SEEDS),
  op("gallery_albums", GALLERY_ALBUM_SEEDS),
  op("gallery_media", GALLERY_MEDIA_SEEDS),
  op("temple_areas", TEMPLE_AREA_SEEDS),
  op("testimonials", TESTIMONIAL_SEEDS),
  op("members", MEMBER_SEEDS),
  op("volunteers", VOLUNTEER_SEEDS),
  op("quotes", QUOTE_SEEDS),
  {
    table: "settings_documents",
    conflict: "document_key",
    seedWhen: "always",
    rows: SETTINGS_DOCUMENT_SEEDS.map((s) => ({
      document_key: s.documentKey,
      data: s.data,
      source_field_count: Object.keys(s.data).length,
    })),
  },
  // Created by the migration, seeded with no rows (no fabricated analytics).
  { table: "page_views", conflict: "id", rows: [], insertOnly: true },
  { table: "daily_page_stats", conflict: "id", rows: [], insertOnly: true },
  { table: "intent_metrics", conflict: "id", rows: [], insertOnly: true },
  { table: "intent_feedback", conflict: "id", rows: [], insertOnly: true },
  { table: "chat_metrics", conflict: "id", rows: [], insertOnly: true },
];

/** Tables that must exist for the application to run, seeded or not. */
export const REQUIRED_TABLES: string[] = SEED_PLAN.map((o) => o.table);
