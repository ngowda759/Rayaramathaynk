import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Source options for the "add featured content" picker: recent events, announcements,
 * sevas and knowledge articles. Admin-only.
 *
 * Field remaps from the retired Firestore documents: events carry `image_url` (not
 * `imageUrl`), sevas use `name`, and knowledge titles are plain text (not `{en, kn}`).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();

    const [events, announcements, sevas, knowledge] = await Promise.all([
      supabase.from("events").select("id, firestore_id, title, image_url").limit(5),
      supabase.from("announcements").select("id, firestore_id, title").limit(5),
      supabase.from("sevas").select("id, firestore_id, name, image_url").limit(5),
      supabase.from("ai_knowledge").select("id, firestore_id, title").limit(5),
    ]);
    for (const result of [events, announcements, sevas, knowledge]) {
      if (result.error) throw new Error(result.error.message);
    }

    const publicId = (row: any) => row.firestore_id || row.id;

    const options = [
      ...(events.data ?? []).map((row: any) => ({
        id: publicId(row),
        type: "event" as const,
        title: row.title || "Untitled Event",
        imageUrl: row.image_url ?? undefined,
        linkUrl: `/events/${publicId(row)}`,
      })),
      ...(announcements.data ?? []).map((row: any) => ({
        id: publicId(row),
        type: "announcement" as const,
        title: row.title || "Untitled Announcement",
        linkUrl: `/announcements/${publicId(row)}`,
      })),
      ...(sevas.data ?? []).map((row: any) => ({
        id: publicId(row),
        type: "seva" as const,
        title: row.name || "Untitled Seva",
        imageUrl: row.image_url ?? undefined,
        linkUrl: `/sevas`,
      })),
      ...(knowledge.data ?? []).map((row: any) => ({
        id: publicId(row),
        type: "knowledge" as const,
        title: row.title || "Untitled Article",
        linkUrl: `/knowledge/article/${publicId(row)}`,
      })),
    ];

    return NextResponse.json({ success: true, options });
  } catch (error) {
    console.error("[admin/featured/options] failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load content options" }, { status: 500 });
  }
}
