// POST /api/seed-ai-settings
//
// Safely initializes AI settings for a Super Admin.
//
// Guarantees:
// - Requires an authenticated admin (same mechanism as every other AI API).
// - Idempotent: repeated calls produce the same result and never duplicate data.
// - Preserves existing settings and admin customizations: existing values are
//   never overwritten merely to make the dashboard green.
// - Repairs only *missing* sections of an existing record, leaving populated
//   sections untouched.
// - Reports per-section outcomes: initialized | already_present | repaired |
//   skipped | failed.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultSeedPayload } from "@/lib/ai/ai-settings/seed-data";

export const dynamic = "force-dynamic";

type SectionOutcome =
  | "initialized"
  | "already_present"
  | "repaired"
  | "skipped"
  | "failed";

interface SectionReport {
  status: SectionOutcome;
  detail?: string;
}

const SEED_PAYLOAD = () => getDefaultSeedPayload("seed");

// Maps a persisted column to the section key used in the seed payload.
const SECTION_COLUMNS: Array<{ key: string; column: string }> = [
  { key: "general", column: "general" },
  { key: "safety", column: "safety" },
  { key: "extendedBehavior", column: "extended_behavior" },
  { key: "templeInformation", column: "temple_information" },
  { key: "visitorInformation", column: "visitor_information" },
  { key: "templePolicies", column: "temple_policies" },
  { key: "aiResponses", column: "ai_responses" },
  { key: "aiBehavior", column: "ai_behavior" },
  { key: "prompt", column: "prompt" },
  { key: "intents", column: "intents" },
];

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 0) return true;
    // prompt/intents containers are "empty" when their inner collection is empty.
    if (Array.isArray(obj.versions) && obj.versions.length === 0 && !obj.defaultPrompt) {
      return true;
    }
    if (Array.isArray(obj.intents) && obj.intents.length === 0) return true;
    return false;
  }
  return false;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;
  const admin = guard.user;

  try {
    const supabase = createAdminClient();
    const defaults = SEED_PAYLOAD();

    // Load the existing record (read-only) to decide what needs repairing.
    const { data: existing, error: readError } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("id", "main")
      .maybeSingle();

    if (readError) {
      console.error("Error reading AI settings during seed:", readError);
      return NextResponse.json(
        { error: "Failed to read existing AI settings", details: readError.message },
        { status: 500 }
      );
    }

    const report: Record<string, SectionReport> = {};

    // Fresh initialization: no record exists yet.
    if (!existing) {
      const payload = { ...defaults, updated_by: admin.uid };
      const { error } = await supabase.from("ai_settings").insert([payload]);
      if (error) {
        console.error("Error seeding AI settings in Supabase:", error);
        return NextResponse.json(
          { error: "Failed to seed AI settings", details: error.message },
          { status: 500 }
        );
      }
      for (const { key } of SECTION_COLUMNS) {
        report[key] = { status: "initialized" };
      }
      return NextResponse.json({
        ok: true,
        outcome: "initialized",
        message: "AI settings initialized successfully.",
        sections: report,
      });
    }

    // Record exists: repair only missing sections, preserve everything else.
    const repair: Record<string, unknown> = {};
    let repairedCount = 0;

    for (const { key, column } of SECTION_COLUMNS) {
      const currentValue = (existing as Record<string, unknown>)[column];
      const defaultValue = (defaults as Record<string, unknown>)[column];

      if (isEmptyValue(currentValue) && !isEmptyValue(defaultValue)) {
        repair[column] = defaultValue;
        report[key] = { status: "repaired", detail: "missing values restored from defaults" };
        repairedCount++;
      } else if (isEmptyValue(currentValue) && isEmptyValue(defaultValue)) {
        report[key] = { status: "skipped", detail: "no default available" };
      } else {
        report[key] = { status: "already_present" };
      }
    }

    if (repairedCount === 0) {
      return NextResponse.json({
        ok: true,
        outcome: "already_present",
        message:
          "AI settings already exist and are complete. No changes were made.",
        sections: report,
      });
    }

    repair.updated_by = admin.uid;
    const { error: updateError } = await supabase
      .from("ai_settings")
      .update(repair)
      .eq("id", "main");

    if (updateError) {
      console.error("Error repairing AI settings:", updateError);
      return NextResponse.json(
        {
          error: "Failed to repair missing AI settings",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      outcome: "repaired",
      message: `Repaired ${repairedCount} missing AI settings section(s). Existing values were preserved.`,
      sections: report,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
