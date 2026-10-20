/**
 * POST /api/seva/day-close/reopen { dayCloseId, reason } - temple admins and super admins reopen a closed day with a
 * reason (C-24, DB §3.3 `dayclose.reopen`).
 */

import type { NextRequest } from "next/server";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { dayCloseReopenSchema, reopenDay } from "@/lib/seva/server/dayclose";
import { parseInput, readJson } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function POST(req: NextRequest) {
  try {
    const guard = await requireSevaActor(req, "dayclose.reopen");
    if (!guard.ok) return guard.response;

    const body = parseInput(dayCloseReopenSchema, await readJson(req));
    await reopenDay(guard.actor, body.dayCloseId, body.reason);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
