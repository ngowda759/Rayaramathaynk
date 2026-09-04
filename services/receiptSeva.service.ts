import { ReceiptSeva, ReceiptSevaInput } from "@/types/receiptSeva";

const BASE_URL = "/api/admin/receipt-sevas";

function authHeaders(idToken: string,): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  };
}

function normalizeTimestamps(value: unknown, fallback: string): string {
  if (!value) return fallback;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof (value as { seconds?: unknown }).seconds === "number") {
return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return String(value);
}

function docToReceiptSeva(data: Record<string, unknown>): ReceiptSeva {
  return {
    id: String(data.id || ""),
    name: String(data.name || ""),
    description: String(data.description || ""),
    amount: Number(data.amount || 0),
    active: Boolean(data.active ?? true),
    displayOrder: Number(data.displayOrder || 0),
    createdAt: normalizeTimestamps(data.createdAt, ""),
    updatedAt: normalizeTimestamps(data.updatedAt, ""),
  };
}

class ReceiptSevaService {
  async getAllSevas(idToken: string): Promise<ReceiptSeva[]> {
    const response = await fetch(BASE_URL, {
      headers: authHeaders(idToken),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "Failed to load seva catalogue");
    }

    const payload = await response.json();
    const items = Array.isArray(payload.sevas) ? payload.sevas : [];
    return items.map((item:any) => docToReceiptSeva(item as Record<string, unknown>));
  }

  async getActiveSevas(idToken: string): Promise<ReceiptSeva[]> {
    const sevas = await this.getAllSevas(idToken);
    return sevas
      .filter((seva) => seva.active)
      .sort((a,b) => a.displayOrder - b.displayOrder);
  }

  async createSeva(
    input: ReceiptSevaInput,
    idToken: string
  ): Promise<{ id: string }> {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: authHeaders(idToken),
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to create seva");
    }

    return { id: String(payload.id || "") };
  }

  async updateSeva(
    id: string,
    input: Partial<ReceiptSevaInput>,
    idToken: string
  ): Promise<void> {
    const response = await fetch(`${BASE_URL}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: authHeaders(idToken),
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to update seva");
    }
  }
}

export const receiptSevaService = new ReceiptSevaService();