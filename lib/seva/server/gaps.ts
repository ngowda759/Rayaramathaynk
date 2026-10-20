/**
 * Entering the receipts of an open number gap from the paper book (C-52, DB §8.4-8.5, A5-FIX M-6). A temple admin or
 * super admin types each slip in; seva_enter_paper_receipt stores it under its printed number, takes the number out
 * of the gap and closes the gap as entered_from_paper when its last number is entered. Gap resolution as "declared
 * lost" stays in receipts.ts (resolveGap).
 */

import "server-only";
import { fromPaise } from "@/lib/seva/money";
import type { SevaActor } from "@/lib/seva/permissions";
import { newQrToken } from "@/lib/seva/qr";
import type { PaperReceiptRequest } from "@/lib/seva/schemas";
import { SevaError } from "@/lib/seva/errors";
import type { ReceiptListItem } from "@/types/seva-receipts";
import { listReceiptsByIds } from "./receipts";
import { callRpc } from "./rpc";

/** The permission paper entry needs: the gap right, held by temple admins and super admins (DB §3.3 row 17). */
export const PAPER_ENTRY_ACTION = "gap.resolve" as const;

export type GapStatusAfterEntry = "open" | "entered_from_paper";

/** The p_receipt of seva_enter_paper_receipt: snake_case, money as rupee strings, a fresh QR token for the receipt. */
export function toSqlPaperReceipt(body: PaperReceiptRequest, qrToken: string): Record<string, unknown> {
  const d = body.devotee;
  return {
    receipt_no: body.receiptNo,
    issued_on: body.issuedOn,
    seva_date: body.sevaDate,
    devotee: {
      name: d.name,
      gotra: d.gotra?.text ?? null,
      gotra_id: d.gotra?.id ?? null,
      nakshatra_id: d.nakshatra?.id ?? null,
      nakshatra_text: d.nakshatra?.text ?? null,
      rashi_id: d.rashi?.id ?? null,
      rashi_text: d.rashi?.text ?? null,
      phone_e164: d.phone ?? null,
    },
    lines: body.lines.map((l) => ({
      seva_id: l.sevaId,
      quantity: l.quantity,
      // null = the catalogue rate in force on the slip's date.
      unit_rate: l.unitRatePaise === undefined ? null : fromPaise(l.unitRatePaise),
    })),
    expected_total: fromPaise(body.totalPaise),
    payment: body.payment.mode === "upi" ? { mode: "upi", upi_ref_last6: body.payment.upiRefLast6 } : { mode: "cash" },
    qr_token: qrToken,
    note: body.note,
  };
}

function readAnswer(answer: unknown): { receiptId: string; gapStatus: GapStatusAfterEntry } {
  if (answer !== null && typeof answer === "object" && !Array.isArray(answer)) {
    const a = answer as { receipts?: unknown; gap_status?: unknown };
    const first = Array.isArray(a.receipts) ? (a.receipts[0] as { id?: unknown } | undefined) : undefined;
    if (first && typeof first.id === "string" && (a.gap_status === "open" || a.gap_status === "entered_from_paper")) {
      return { receiptId: first.id, gapStatus: a.gap_status };
    }
  }
  throw new SevaError("internal");
}

export async function enterPaperReceipt(
  actor: SevaActor,
  gapId: number,
  body: PaperReceiptRequest,
): Promise<{ receipt: ReceiptListItem | null; gapStatus: GapStatusAfterEntry }> {
  const answer = await callRpc<unknown>("seva_enter_paper_receipt", {
    p_gap_id: gapId,
    p_receipt: toSqlPaperReceipt(body, newQrToken()),
    p_staff_id: actor.staffId,
  });
  const { receiptId, gapStatus } = readAnswer(answer);
  const [receipt] = await listReceiptsByIds([receiptId]);
  return { receipt: receipt ?? null, gapStatus };
}
