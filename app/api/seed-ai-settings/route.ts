import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/auth/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultSeedPayload } from "@/lib/ai/ai-settings/seed-data";

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminUser(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Check if configuration already exists to prevent destructive overwrites
    const { data: existingData } = await supabase
        .from("ai_settings")
        .select("id")
        .eq("id", "main")
        .maybeSingle();

    if (existingData) {
        return NextResponse.json({
            message: "AI settings already exist. Seed operation skipped to prevent overwriting admin changes.",
        });
    }

    const payload = getDefaultSeedPayload(admin.uid);

    const { error } = await supabase
      .from("ai_settings")
      .insert([payload]);

    if (error) {
      console.error("Error seeding AI settings in Supabase:", error);
      return NextResponse.json(
        { error: "Failed to seed AI settings", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "AI settings seeded successfully to Supabase",
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
