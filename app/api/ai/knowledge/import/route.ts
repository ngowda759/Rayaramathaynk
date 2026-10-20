import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin-auth";
import * as fs from "fs";
import * as path from "path";

// Knowledge categories - must match categories in seed files
const REQUIRED_CATEGORIES = [
  "temple-timings",
  "visitor-guidelines",
  "dress-code",
  "facilities",
  "parking",
  "volunteer",
  "faq",
  "contact",
  "donation",
  "photography",
  "accommodation",
  "history",
  "raghavendra-swamy",
  "brindavana",
  "about-trust",
  // Additional categories for complete coverage
  "aaradhane",
  "about",
  "events",
  "future-plans",
  "gallery",
  "guruparampara",
  "journey",
  "pooja",
  "sevas",
  "shlokas",
  "temple-explorer",
  "testimonials",
  "trust",
  "madhvacharya",
  "mantralaya",
];

interface SeedArticle {
  title: string;
  category: string;
  content?: string;
  [key: string]: unknown;
}

/**
 * Build the persisted `content` column from a seed file.
 *
 * Seed files are structured JSON (questions/answers, sections, etc.) rather than
 * a single prose blob, so the whole document minus the columns stored
 * separately is serialised into `content`. This preserves the seed data exactly
 * as authored and never invents content.
 */
function buildContent(article: SeedArticle): string {
  if (typeof article.content === "string" && article.content.trim()) {
    return article.content;
  }
  const { slug, title, category, language, keywords, approved, ...rest } = article;
  void slug;
  void title;
  void category;
  void language;
  void keywords;
  void approved;
  return JSON.stringify(rest, null, 2);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: NextRequest) {
  // This endpoint writes knowledge articles; it must require an authenticated
  // admin, exactly like the other protected AI APIs.
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  try {
    // The knowledge importer is additive only. A client-supplied `overwrite`
    // flag is ignored on purpose: replacing an existing article would discard
    // its content and its approval/review state. An authorized overwrite path
    // (audited, explicitly requested) is a separate feature and is not enabled
    // here.
    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && "overwrite" in body) {
      const requested = (body as { overwrite?: unknown }).overwrite;
      if (requested === true) {
        console.warn(
          "[ai/knowledge/import] Ignoring overwrite=true: overwrite is not authorized on this endpoint."
        );
      }
    }

    const seedDir = path.join(process.cwd(), "seed", "ai");

    if (!fs.existsSync(seedDir)) {
      return NextResponse.json(
        { success: false, error: "Seed directory not found" },
        { status: 404 }
      );
    }

    const supabase = createAdminClient();

    // Deduplicate by slug, the column the database enforces as UNIQUE, and
    // consider EVERY existing row (approved or not). Keying on category alone
    // would let a seed file replace a same-slug article that is pending review.
    const existingSlugs = new Set<string>();
    const { data: existing, error: existingError } = await supabase
      .from("ai_knowledge")
      .select("id, slug");

    if (existingError) {
      console.error("Error reading existing knowledge:", existingError.message);
      return NextResponse.json(
        { success: false, error: "Failed to read existing knowledge" },
        { status: 500 }
      );
    }

    for (const row of existing || []) {
      if (row.slug) existingSlugs.add(row.slug);
    }

    // Get seed files
    const seedFiles = fs.readdirSync(seedDir).filter((f) => f.endsWith(".json"));

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const results: Array<{ file: string; status: "imported" | "skipped" | "error"; message?: string }> = [];

    for (const file of seedFiles) {
      const filePath = path.join(seedDir, file);

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const article: SeedArticle = JSON.parse(content);

        if (!article.category) {
          results.push({ file, status: "error", message: "Missing category" });
          errors++;
          continue;
        }

        const slug =
          typeof article.slug === "string" && article.slug
            ? article.slug
            : slugify(article.title || article.category);

        // Skip when the slug already exists. Because this runs BEFORE any write,
        // an existing article is never replaced and its approval/review state
        // and content are preserved.
        if (existingSlugs.has(slug)) {
          results.push({ file, status: "skipped", message: "Already exists" });
          skipped++;
          continue;
        }

        // Plain insert (no upsert): if a row with this slug appeared after our
        // read, the UNIQUE constraint rejects the insert instead of overwriting.
        const { error } = await supabase.from("ai_knowledge").insert({
          slug,
          title: article.title || article.category,
          category: article.category,
          language: typeof article.language === "string" ? article.language : "en",
          keywords: Array.isArray(article.keywords) ? article.keywords : [article.category],
          content: buildContent(article),
          approved: true,
          updated_at: new Date().toISOString(),
        });

        if (error) {
          results.push({ file, status: "error", message: error.message });
          errors++;
          continue;
        }

        existingSlugs.add(slug);

        results.push({ file, status: "imported", message: article.title });
        imported++;
      } catch (error) {
        results.push({ file, status: "error", message: String(error) });
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        errors,
        results,
        summary: {
          total: seedFiles.length,
          coverage: Math.round((imported / REQUIRED_CATEGORIES.length) * 100),
        },
      },
    });
  } catch (error) {
    console.error("Error importing knowledge:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import knowledge" },
      { status: 500 }
    );
  }
}
