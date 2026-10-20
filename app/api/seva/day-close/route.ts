/**
 * GET  /api/seva/day-close?counterId&date  - what the close-day screen shows (DayClosePrep).
 * POST /api/seva/day-close                 - close one counter's business date -> { dayCloseId }.
 *
 * Both need `dayclose.close`: a receptionist only for the verified device's counter and today (IST); temple admins
 * and super admins for any counter and date (DB §3.3, §9.10). The counter and date being closed are what the guard
 * judges, so they are read before it. With no counterId the verified PC's own counter is meant: the guard takes it
 * from the PC it verifies after the sign-in, so nothing about a PC is read for a caller who is not signed in (A3
 * security gate L-1).
 */

import type { NextRequest } from "next/server";
import { SevaError } from "@/lib/seva/errors";
import { dayCloseSchema } from "@/lib/seva/schemas";
import { requireSevaActor } from "@/lib/seva/server/auth";
import { closeDay, dayClosePrepareQuerySchema, prepareDayClose } from "@/lib/seva/server/dayclose";
import { parseInput, queryOf, readJson } from "@/lib/seva/server/reports";
import { sevaErrorResponse, sevaJson } from "@/lib/seva/server/respond";
import { businessDate } from "@/lib/seva/time";

export async function GET(req: NextRequest) {
  try {
    const q = parseInput(dayClosePrepareQuerySchema, queryOf(req));
    const date = q.date ?? businessDate(new Date());

    const guard = await requireSevaActor(
      req,
      "dayclose.close",
      q.counterId === undefined
        ? { device: "optional", counterFromDevice: true, ctx: { receiptBusinessDate: date } }
        : { device: "optional", ctx: { receiptCounterId: q.counterId, receiptBusinessDate: date } },
    );
    if (!guard.ok) return guard.response;

    const counterId = q.counterId ?? guard.device?.counterId;
    if (counterId === undefined) throw new SevaError("validation", { field: "counterId", message: "Choose a counter." });
    return sevaJson(await prepareDayClose(counterId, date));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = parseInput(dayCloseSchema, await readJson(req));

    const guard = await requireSevaActor(req, "dayclose.close", {
      device: "optional",
      ctx: { receiptCounterId: body.counterId, receiptBusinessDate: body.businessDate },
    });
    if (!guard.ok) return guard.response;

    return sevaJson(await closeDay(guard.actor, body));
  } catch (error) {
    return sevaErrorResponse(error);
  }
}
