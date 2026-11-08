import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/supabase/identifier";

const registerBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email format")),
  phone: z.string().optional().default(""),
  userId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => null);
    if (!raw) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = registerBodySchema.safeParse(raw);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { name, email, phone, userId } = parseResult.data;
    const supabase = createAdminClient();

    if (userId && isUuid(userId)) {
      // Check if user already exists
      const { data: existing } = await supabase
        .from("users")
        .select("id, role")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: true, message: "User already provisioned" });
      }

      // Provision default devotee user
      const { error: insertError } = await supabase.from("users").insert({
        auth_user_id: userId,
        email,
        display_name: name,
        phone_number: phone || null,
        role: "devotee",
        active: true,
      });

      if (insertError) {
        console.error("[api/auth/register] Insert error:", insertError);
        return NextResponse.json({ error: "Failed to provision user profile" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error("[api/auth/register] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
