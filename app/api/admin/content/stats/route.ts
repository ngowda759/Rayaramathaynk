import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Content dashboard counts and the recent/draft lists for the admin console.
 *
 * Replaces the browser's direct Firestore reads. Every counted table is deny-all
 * under RLS, so the aggregation runs here with the service role and only counts and
 * titles leave the server. Admin-only.
 *
 * Note the field-name remap from the retired Firestore documents: events use
 * `start_date`/`published` (not `date`/`active`), announcements use `is_active`, and
 * knowledge titles are plain text (not a `{en, kn}` map).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    async function count(table: string, apply?: (q: any) => any): Promise<number> {
      let query = supabase.from(table).select("*", { count: "exact", head: true });
      if (apply) query = apply(query);
      const { count: value, error } = await query;
      if (error) throw new Error(`Could not count ${table}: ${error.message}`);
      return value ?? 0;
    }

    const [
      events,
      upcomingEvents,
      announcements,
      activeAnnouncements,
      gallery,
      sevas,
      poojas,
      knowledgeArticles,
      testimonials,
      pendingTestimonials,
      volunteers,
    ] = await Promise.all([
      count("events"),
      count("events", (q) => q.gte("start_date", nowIso)),
      count("announcements"),
      count("announcements", (q) => q.eq("is_active", true)),
      count("gallery_media"),
      count("sevas"),
      count("daily_poojas"),
      count("ai_knowledge"),
      count("testimonials"),
      count("testimonials", (q) => q.eq("approved", false).eq("rejected", false)),
      count("volunteer_requests"),
    ]);

    const [recentEvents, recentAnnouncements, recentKnowledge] = await Promise.all([
      supabase.from("events").select("id, firestore_id, title, published, updated_at").order("updated_at", { ascending: false }).limit(3),
      supabase.from("announcements").select("id, firestore_id, title, is_active, updated_at").order("updated_at", { ascending: false }).limit(3),
      supabase.from("ai_knowledge").select("id, firestore_id, title, approved, updated_at").order("updated_at", { ascending: false }).limit(3),
    ]);
    if (recentEvents.error) throw new Error(recentEvents.error.message);
    if (recentAnnouncements.error) throw new Error(recentAnnouncements.error.message);
    if (recentKnowledge.error) throw new Error(recentKnowledge.error.message);

    const publicId = (row: any) => row.firestore_id || row.id;
    const asDate = (value: unknown) =>
      value ? new Date(value as string).toLocaleDateString() : "Unknown";

    const recentItems = [
      ...(recentEvents.data ?? []).map((row: any) => ({
        id: publicId(row),
        title: row.title || "Untitled Event",
        type: "Event",
        status: row.published ? "Active" : "Draft",
        updatedAt: asDate(row.updated_at),
        href: `/admin/events/${publicId(row)}/edit`,
      })),
      ...(recentAnnouncements.data ?? []).map((row: any) => ({
        id: publicId(row),
        title: row.title || "Untitled",
        type: "Announcement",
        status: row.is_active ? "Active" : "Draft",
        updatedAt: asDate(row.updated_at),
        href: `/admin/announcements/${publicId(row)}/edit`,
      })),
      ...(recentKnowledge.data ?? []).map((row: any) => ({
        id: publicId(row),
        title: row.title || "Untitled",
        type: "Article",
        status: row.approved ? "Published" : "Draft",
        updatedAt: asDate(row.updated_at),
        href: `/admin/knowledge/${publicId(row)}/edit`,
      })),
    ].slice(0, 6);

    const [draftEvents, draftAnnouncements] = await Promise.all([
      supabase.from("events").select("id, firestore_id, title, updated_at").eq("published", false).limit(3),
      supabase.from("announcements").select("id, firestore_id, title, updated_at").eq("is_active", false).limit(3),
    ]);
    if (draftEvents.error) throw new Error(draftEvents.error.message);
    if (draftAnnouncements.error) throw new Error(draftAnnouncements.error.message);

    const draftItems = [
      ...(draftEvents.data ?? []).map((row: any) => ({
        id: publicId(row),
        title: row.title || "Untitled Event",
        type: "Event",
        updatedAt: asDate(row.updated_at),
        href: `/admin/events/${publicId(row)}/edit`,
      })),
      ...(draftAnnouncements.data ?? []).map((row: any) => ({
        id: publicId(row),
        title: row.title || "Untitled Announcement",
        type: "Announcement",
        updatedAt: asDate(row.updated_at),
        href: `/admin/announcements/${publicId(row)}/edit`,
      })),
    ];

    return NextResponse.json({
      success: true,
      stats: {
        events,
        upcomingEvents,
        announcements,
        activeAnnouncements,
        gallery,
        sevas,
        poojas,
        knowledgeArticles,
        testimonials,
        pendingTestimonials,
        volunteers,
        pendingVolunteers: 0,
      },
      recentItems,
      drafts: draftItems,
    });
  } catch (error) {
    console.error("[admin/content/stats] failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load content stats" }, { status: 500 });
  }
}
