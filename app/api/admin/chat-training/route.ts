import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/auth/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveRowUuid, rowIdFilter } from "@/lib/supabase/identifier";

const TABLE = "chat_training";

/**
 * Raya AI training data (curated keyword -> response pairs).
 *
 * `chat_training` is deny-all under RLS: the pairs are internal assistant
 * configuration, so every method here is admin-only and uses the service role. There
 * is no Firestore path.
 */
function rowToItem(row: any) {
  return {
    id: row.firestore_id || row.id,
    keywords: row.keywords ?? [],
    response: row.response ?? "",
    category: row.category ?? "general",
    priority: row.priority ?? 1,
    active: row.active ?? true,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, items: (data ?? []).map(rowToItem) });
  } catch (error) {
    console.error("[admin/chat-training] read failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load training data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.response || !Array.isArray(body.keywords) || body.keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: "keywords and response are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        keywords: body.keywords,
        response: body.response,
        category: body.category ?? "general",
        priority: body.priority ?? 1,
        active: body.active ?? true,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, id: data.firestore_id || data.id }, { status: 201 });
  } catch (error) {
    console.error("[admin/chat-training] create failed:", error);
    return NextResponse.json({ success: false, error: "Failed to create training data" }, { status: 500 });
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
    if (updates.keywords !== undefined) update.keywords = updates.keywords;
    if (updates.response !== undefined) update.response = updates.response;
    if (updates.category !== undefined) update.category = updates.category;
    if (updates.priority !== undefined) update.priority = updates.priority;
    if (updates.active !== undefined) update.active = updates.active;

    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).update(update).or(rowIdFilter(id));
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/chat-training] update failed:", error);
    return NextResponse.json({ success: false, error: "Failed to update training data" }, { status: 500 });
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
    console.error("[admin/chat-training] delete failed:", error);
    return NextResponse.json({ success: false, error: "Failed to delete training data" }, { status: 500 });
  }
}
