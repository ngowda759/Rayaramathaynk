/**
 * Browser client for the receipt, devotee-search and gap routes (DB §9.8-9.9, §9.2, §12.3, §8.5). Every call carries
 * the signed-in person's ID token and, from a registered counter PC, the device header (sevaFetch). Failures arrive
 * as SevaClientError with the server's code.
 */

import type { RefundSettleRequest } from "@/lib/seva/schemas";
import type { CancelReasonCode, IssueResponse, PaymentMode } from "@/types/seva";
import type { DevoteeMatch, ReceiptDetail, ReceiptListItem } from "@/types/seva-receipts";
import { sevaFetch } from "./http";

export interface ReceiptListParams {
  from?: string;
  to?: string;
  sevaId?: string;
  mode?: PaymentMode;
  status?: string;
  q?: string;
  cursor?: string;
}

function queryString(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, value);
  }
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

export function receiptsApi(token: () => Promise<string>, device: () => string | null) {
  async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
    return sevaFetch<T>(path, { ...init, token: await token(), deviceHeader: device() });
  }

  return {
    list(q: ReceiptListParams): Promise<{ rows: ReceiptListItem[]; nextCursor: string | null }> {
      return call(`/api/seva/receipts${queryString({ ...q })}`);
    },
    get(id: string): Promise<ReceiptDetail> {
      return call(`/api/seva/receipts/${encodeURIComponent(id)}`);
    },
    cancel(b: { receiptIds: string[]; reasonCode: CancelReasonCode; note?: string }): Promise<{ receipts: ReceiptListItem[] }> {
      return call("/api/seva/receipts/cancel", { method: "POST", body: b });
    },
    reissue(id: string): Promise<IssueResponse> {
      return call(`/api/seva/receipts/${encodeURIComponent(id)}/reissue`, { method: "POST", body: {} });
    },
    async searchDevotees(q: { name?: string; phone?: string }): Promise<DevoteeMatch[]> {
      const answer = await call<{ matches: DevoteeMatch[] }>(
        `/api/seva/devotees/search${queryString({ name: q.name, phone: q.phone })}`,
      );
      return answer.matches;
    },
    async resolveGap(id: number, b: { status: "entered_from_paper" | "declared_lost"; note: string }): Promise<void> {
      await call<{ ok: true }>(`/api/seva/gaps/${encodeURIComponent(String(id))}`, { method: "POST", body: b });
    },
    /** Marks refund-due receipts as refunded (A5-FIX M-3); temple admins and super admins. */
    settleRefund(b: RefundSettleRequest): Promise<{ receipts: ReceiptListItem[] }> {
      return call("/api/seva/receipts/refund", { method: "POST", body: b });
    },
  };
}
