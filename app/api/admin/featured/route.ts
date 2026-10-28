import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveRowUuid, rowIdFilter } from "@/lib/supabase/identifier";

const TABLE = "featured_content";

/**
 * Featured-content curation for the homepage carousel.
 *
 * `featured_content` is public-readable but admin-writable, so every method here is
 * admin-only and uses the service role for writes. There is no Firestore path.
 */
function rowToItem(row: any) {
  return {
    id: row.firestore_id || row.id,
    contentId: row.content_id ?? "",
    contentType: row.content_type ?? "custom",
    title: row.title ?? "",
    description: row.description ?? "",
    imageUrl: row.image_url ?? undefined,
    linkUrl: row.link_url ?? "",
    linkLabel: row.link_label ?? "",
    priority: row.priority ?? 1,
    isActive: row.is_active ?? true,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from(TABLE).select("*").order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, items: (data ?? []).map(rowToItem) });
  } catch (error) {
    console.error("[admin/featured] read failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load featured content" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.title) {
      return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        content_id: body.contentId ?? "",
        content_type: body.contentType ?? "custom",
        title: body.title,
        description: body.description ?? "",
        image_url: body.imageUrl ?? null,
        link_url: body.linkUrl ?? "",
        link_label: body.linkLabel ?? "",
        priority: body.priority ?? 1,
        is_active: body.isActive ?? true,
        start_date: body.startDate ?? null,
        end_date: body.endDate ?? null,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, id: data.firestore_id || data.id }, { status: 201 });
  } catch (error) {
    console.error("[admin/featured] create failed:", error);
    return NextResponse.json({ success: false, error: "Failed to create featured item" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.priority !== undefined) update.priority = updates.priority;
    if (updates.isActive !== undefined) update.is_active = updates.isActive;
    if (updates.title !== undefined) update.title = updates.title;
    if (updates.description !== undefined) update.description = updates.description;
    if (updates.imageUrl !== undefined) update.image_url = updates.imageUrl;
    if (updates.linkUrl !== undefined) update.link_url = updates.linkUrl;
    if (updates.linkLabel !== undefined) update.link_label = updates.linkLabel;

    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).update(update).or(rowIdFilter(id));
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/featured] update failed:", error);
    return NextResponse.json({ success: false, error: "Failed to update featured item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }
    const supabase = createAdminClient();
    const uuid = await resolveRowUuid(supabase, TABLE, id);
    if (uuid) {
      const { error } = await supabase.from(TABLE).delete().eq("id", uuid);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/featured] delete failed:", error);
    return NextResponse.json({ success: false, error: "Failed to delete featured item" }, { status: 500 });
  }
}
