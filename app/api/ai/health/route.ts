// API Route: /api/ai/health
//
// Read-only health probe for the AI Health dashboard.
//
// This endpoint deliberately uses the SAME authentication mechanism as every
// other protected AI API (`requireAdminUser`) so an authentication problem is
// reported as an authentication problem — not as a database connectivity
// failure.
//
// It performs no writes: it must never create default settings, because a
// health check that mutates production data would mask genuine "missing data"
// warnings.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin-auth";
import { aiAdminRepository } from "@/lib/ai/ai-settings/admin-repository";

export const dynamic = "force-dynamic";

interface SectionPresence {
  temple: boolean;
  visitor: boolean;
  policies: boolean;
  responses: boolean;
  behavior: boolean;
  prompts: boolean;
  intents: boolean;
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  // Read-only connectivity probe: reading the settings document exercises the
  // server-side Firestore/Supabase Admin credentials without writing anything.
  try {
    const settings = await aiAdminRepository.getSettings();

    const presence: SectionPresence = {
      temple: hasContent(settings?.templeInformation),
      visitor: hasContent(settings?.visitorInformation),
      policies: hasContent(settings?.templePolicies),
      responses: hasContent(settings?.aiResponses),
      behavior: hasContent(settings?.aiBehavior),
      prompts:
        hasContent(settings?.prompt?.versions) ||
        hasContent(settings?.prompt?.defaultPrompt),
      intents: hasContent(settings?.intents?.intents),
    };

    return NextResponse.json(
      {
        database: {
          connected: true,
          message: "Successfully connected to the datastore",
        },
        settings: {
          hasMainRecord: settings !== null,
          present: presence,
        },
        timestamp: Date.now(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[ai/health] Datastore connectivity check failed:", error);
    return NextResponse.json(
      {
        database: {
          connected: false,
          message: "Could not reach the datastore",
        },
        timestamp: Date.now(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
