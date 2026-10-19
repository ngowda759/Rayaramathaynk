/**
 * POST /api/seva/counter/sync - the outbox of a registered counter PC (DB §6.5 F2, §8.3, §9.11): offline orders and
 * offline cancels, stored in `seq` order. Each item is answered on its own; a business refusal does not stop the
 * rest. Any other failure stops at that item and answers 503 with the results so far, so the PC keeps that item and
 * everything after it and tries again later (every item is idempotent on the server).
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sevaErrorMessage } from "@/lib/seva/errors";
import { syncRequestSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { liveDevice, parseBody, readJsonBody, syncOutbox } from "@/lib/seva/server/counter";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";

export async function POST(req: NextRequest) {
  const guard = await requireSevaActor(req, "counter.issue", { device: "required" });
  if (!guard.ok) return guard.response;
  try {
    const device = liveDevice(guard.device);
    const { items } = parseBody(syncRequestSchema, await readJsonBody(req));
    const { results, failure } = await syncOutbox(guard.actor, device, items);
    if (failure === null) return sevaJson({ results });

    // Logs carry a request id and the kind of failure only - never names, phones or database text.
    const requestId = randomUUID();
    const kind = failure instanceof Error ? failure.name : typeof failure;
    console.error("[seva] counter sync stopped:", "request", requestId, "kind", kind, "after", results.length, "items");
    return NextResponse.json(
      { error: { code: "internal", message: sevaErrorMessage("internal") }, results },
      { status: 503, headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
