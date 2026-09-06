import { Receipt, ReceiptCreateInput } from "@/types/receipt";

const BASE_URL = "/api/admin/receipts";

function authHeaders(idToken: string,): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  };
}

function docToReceipt(data: Record<string, unknown>): Receipt {
  return {
    id: String(data.id || ""),
    receiptNumber: String(data.receiptNumber || ""),
    devoteeName: String(data.devoteeName || ""),
    devoteePhone: data.devoteePhone ? String(data.devoteePhone) : undefined,
    devoteeEmail: data.devoteeEmail ? String(data.devoteeEmail) : undefined,
    devoteeAddress: data.devoteeAddress ? String(data.devoteeAddress) : undefined,
    items: Array.isArray(data.items) ? (data.items as Receipt["items"]): [],
    subtotal: Number(data.subtotal || 0),
    totalAmount: Number(data.totalAmount || 0),
    paymentMode: data.paymentMode === "upi" ? "upi" : "upi",
    paymentReference: data.paymentReference ? String(data.paymentReference) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: normalizeTimestamp(data.createdAt),
    createdBy: String(data.createdBy || ""),
  };
}

function normalizeTimestamp(value: unknown): string {
  if (!value) return "";
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof (value as { seconds?: unknown }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return String(value);
}

export interface ReceiptListParams {
  search?: string;
  from?: string;
  to?: string;
  sevaId?: string;
  page?: number;
  pageSize?: number;
  export?: boolean;
}

export interface ReceiptReport {
  summary: { total: number; collection: number; upiCollection: number };
  sevaWise: { seva: string; quantity: number; amount: number }[];
  timeline: { period: string; count: number; amount: number }[];
}

class ReceiptService {
  async getReceipts(params: ReceiptListParams, idToken: string): Promise<Receipt[]> {
    const query = new URLSearchParams(
      [
        ["search", params.search || ""],
        ["from", params.from || ""],
        ["to", params.to || ""],
        ["sevaId", params.sevaId || ""],
        ["page", params.page ? String(params.page) : ""],
        ["pageSize", params.pageSize ? String(params.pageSize) : ""],
        ["export", params.export ? "true" : ""],
      ].filter(([, value]) => value.length > 0)
    );
    const url = query.toString() ? `${BASE_URL}?${query.toString()}` : BASE_URL;

    const response = await fetch(url, {
      headers: authHeaders(idToken),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "Failed to load receipts");
    }

    const payload = await response.json();
    const items = Array.isArray(payload.receipts) ? payload.receipts : [];
    return items.map((item:any) => docToReceipt(item as Record<string, unknown>));
  }

  async getReceiptReport(params: { from: string; to: string }, idToken: string): Promise<ReceiptReport> {
    const query = new URLSearchParams([
      ["from", params.from || ""],
      ["to", params.to || ""],
      ["report", "true"]
    ].filter(([, value]) => value.length > 0));

    const url = query.toString() ? `${BASE_URL}?${query.toString()}` : BASE_URL;

    const response = await fetch(url, {
      headers: authHeaders(idToken),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "Failed to load receipt report");
    }

    const payload = await response.json();
    return {
      summary: payload.summary || { total: 0, collection: 0, upiCollection: 0 },
      sevaWise: payload.sevaWise || [],
      timeline: payload.timeline || []
    };
  }

  async getReceipt(id: string, idToken: string): Promise<Receipt> {
    const response = await fetch(`${BASE_URL}/${encodeURIComponent(id)}`, {
      headers: authHeaders(idToken),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "Failed to load receipt");
    }

    const payload = await response.json();
    return docToReceipt(payload.receipt as Record<string, unknown>);
  }

  async getReceiptPdf(id: string, idToken: string): Promise<Blob> {
    const response = await fetch(`${BASE_URL}/${encodeURIComponent(id)}/pdf`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "Failed to generate receipt PDF");
    }

    return await response.blob();
  }

  async createReceipt(
    input: ReceiptCreateInput,
    idToken: string
  ): Promise<{ id: string; receiptNumber: string }> {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: authHeaders(idToken),
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to create receipt");
    }

    return {
      id: String(payload.id || ""),
      receiptNumber: String(payload.receiptNumber || ""),
    };
  }
}

export const receiptService = new ReceiptService();