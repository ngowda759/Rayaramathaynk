/**
 * Settling a due refund (DB §9.9, A5-FIX M-3). A UPI cancel, or a cash cancel the drawer could not hand back, leaves
 * the receipt with refund_state 'due'; the office pays it back outside the module and a temple admin or super admin
 * records it here with the mode, the bank or UPI reference and a note. The SQL function seva_settle_refund checks the
 * rules again in its transaction, sets refund_state 'done' and writes the receipt.refund_done audit row, which clears
 * the "UPI refunds due" card.
 */

import "server-only";
import type { SevaActor } from "@/lib/seva/permissions";
import type { RefundSettleRequest } from "@/lib/seva/schemas";
import type { ReceiptListItem } from "@/types/seva-receipts";
import { listReceiptsByIds } from "./receipts";
import { callRpc } from "./rpc";

/** The permission a refund settle needs: the cancel-any right, held by temple admins and super admins (DB §3.3 row 4). */
export const REFUND_SETTLE_ACTION = "receipt.cancel_any" as const;

export async function settleRefunds(actor: SevaActor, body: RefundSettleRequest): Promise<{ receipts: ReceiptListItem[] }> {
  const ids = [...new Set(body.receiptIds)];
  await callRpc<unknown>("seva_settle_refund", {
    p_receipt_ids: ids,
    p_mode: body.mode,
    p_reference: body.reference && body.reference !== "" ? body.reference : null,
    p_note: body.note,
    p_staff_id: actor.staffId,
  });
  return { receipts: await listReceiptsByIds(ids) };
}
