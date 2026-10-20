/**
 * POST /api/seva/gaps/[id] - resolves an open receipt-number gap as 'entered_from_paper' or 'declared_lost' with a
 * note of at least 3 characters (DB §8.5). Temple admins and super admins (gap.resolve); audited by the SQL function.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { gapResolveSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { parseInput, readJson } from "@/lib/seva/server/read";
import { gapIdSchema, resolveGap } from "@/lib/seva/server/receipts";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

const paramsSchema = z.object({ id: gapIdSchema });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSevaActor(req, "gap.resolve");
  if (!guard.ok) return guard.response;
  try {
    const { id } = parseInput(paramsSchema, await params);
    const body = parseInput(gapResolveSchema, await readJson(req));
    await resolveGap(guard.actor, id, body);
    return sevaJson({ ok: true });
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
