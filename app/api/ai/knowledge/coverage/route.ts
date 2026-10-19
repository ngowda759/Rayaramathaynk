import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/lib/auth/admin-auth";

// Public website pages mapped to categories
// Note: These categories are derived from the seed files in seed/ai/
const PUBLIC_PAGES_CATEGORIES = [
  { id: "aaradhane", name: "Aaradhane", description: "Aaradhane festival and events" },
  { id: "about", name: "About", description: "About the temple/matha" },
  { id: "about-trust", name: "About Temple Trust", description: "About temple trust and management" },
  { id: "donation", name: "Donation", description: "How to donate and tax benefits (80G)" },
  { id: "events", name: "Events", description: "Temple events and schedules" },
  { id: "facilities", name: "Facilities", description: "Available amenities and services" },
  { id: "future-plans", name: "Future Plans", description: "Temple development plans" },
  { id: "gallery", name: "Gallery", description: "Photo gallery" },
  { id: "guruparampara", name: "Guru Parampara", description: "Guru lineage and teachings" },
  { id: "journey", name: "Temple Journey", description: "Temple establishment and journey" },
  { id: "pooja", name: "Pooja Services", description: "Daily poojas and special sevas" },
  { id: "sevas", name: "Sevas", description: "Volunteer and seva opportunities" },
  { id: "shlokas", name: "Shlokas", description: "Sacred slokas and mantras" },
  { id: "temple-explorer", name: "Temple Explorer", description: "Temple areas and facilities" },
  { id: "testimonials", name: "Testimonials", description: "Devotee testimonials" },
  { id: "trust", name: "Trust", description: "Trust committee and management" },
  { id: "volunteer", name: "Volunteer", description: "Volunteer program and opportunities" },
  { id: "faq", name: "FAQ", description: "Frequently asked questions" },
  { id: "contact", name: "Contact", description: "Contact information and office hours" },
  { id: "dress-code", name: "Dress Code", description: "Appropriate attire for visiting" },
  { id: "parking", name: "Parking", description: "Parking information and availability" },
  { id: "history", name: "Temple History", description: "History of the temple" },
  { id: "raghavendra-swamy", name: "Sri Raghavendra Swamy", description: "Biography and teachings" },
  { id: "brindavana", name: "Brindavana", description: "The sacred samadhi information" },
  { id: "madhvacharya", name: "Sri Madhvacharya", description: "Madhvacharya biography and philosophy" },
  { id: "mantralaya", name: "Mantralaya", description: "Mantralaya pilgrimage site" },
  { id: "temple-timings", name: "Temple Timings", description: "Temple opening hours and daily schedule" },
  { id: "visitor-guidelines", name: "Visitor Guidelines", description: "Guidelines for temple visitors" },
];

// Default required categories
const DEFAULT_CATEGORIES = [
  ...PUBLIC_PAGES_CATEGORIES,
  { id: "photography", name: "Photography", description: "Photography policy and guidelines" },
  { id: "accommodation", name: "Accommodation", description: "Guest house and lodging facilities" },
];

interface CoverageStatus {
  id: string;
  name: string;
  description: string;
  status: "present" | "missing";
  articleId?: string;
  articleTitle?: string;
  updatedAt?: Date;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  try {
    const supabase = createAdminClient();

    // Read approved articles from Supabase (the only knowledge store).
    const { data, error } = await supabase
      .from("ai_knowledge")
      .select("id, slug, title, category, updated_at")
      .eq("approved", true);

    if (error) {
      console.error("Error reading knowledge coverage:", error.message);
      return NextResponse.json(
        { success: false, error: "Failed to check knowledge coverage" },
        { status: 500 }
      );
    }

    const existingCategories = new Map<string, { id: string; title: string; updatedAt: Date }>();
    for (const row of data || []) {
      if (row.category) {
        existingCategories.set(row.category, {
          id: row.id,
          title: row.title || row.category,
          updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
        });
      }
    }

    // Build coverage status
    const coverage: CoverageStatus[] = DEFAULT_CATEGORIES.map(cat => {
      const existing = existingCategories.get(cat.id);

      if (existing) {
        return {
          ...cat,
          status: "present" as const,
          articleId: existing.id,
          articleTitle: existing.title,
          updatedAt: existing.updatedAt,
        };
      }

      return {
        ...cat,
        status: "missing" as const,
      };
    });

    const present = coverage.filter(c => c.status === "present").length;
    const missing = coverage.filter(c => c.status === "missing").length;
    const percentage = Math.round((present / DEFAULT_CATEGORIES.length) * 100);

    return NextResponse.json({
      success: true,
      data: {
        coverage,
        summary: {
          total: DEFAULT_CATEGORIES.length,
          present,
          missing,
          percentage,
        },
        lastChecked: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error("Error checking knowledge coverage:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check knowledge coverage" },
      { status: 500 }
    );
  }
}
