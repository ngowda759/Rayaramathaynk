import { apiFetch } from "@/lib/api/fetch";
import {
  Bill,
  BillCreateInput,
  BillUpdateInput,
  BillStatus,
} from "@/types/billing";

/**
 * Billing, stored in Supabase `bills`.
 *
 * `bills` is deny-all under RLS and carries customer contact and payment data, so the
 * browser never reads it directly: every call goes through the admin-guarded
 * `/api/admin/bills` routes, which use the service role server-side. There is no
 * Firestore path.
 */
class BillingService {
  async getBills(): Promise<Bill[]> {
    return apiFetch<Bill[]>("/api/admin/bills");
  }

  async getBill(id: string): Promise<Bill | null> {
    try {
      return await apiFetch<Bill>(`/api/admin/bills/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  }

  async getBillsByStatus(status: BillStatus): Promise<Bill[]> {
    return apiFetch<Bill[]>(`/api/admin/bills?status=${encodeURIComponent(status)}`);
  }

  async getBillsByCustomer(customerName: string): Promise<Bill[]> {
    return apiFetch<Bill[]>(`/api/admin/bills?customer=${encodeURIComponent(customerName)}`);
  }

  async getOverdueBills(): Promise<Bill[]> {
    return apiFetch<Bill[]>("/api/admin/bills?overdue=1");
  }

  async createBill(
    input: BillCreateInput,
    invoicePrefix: string = "INV",
    invoiceNumber: number = 1
  ): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/admin/bills", {
      method: "POST",
      body: { input, invoicePrefix, invoiceNumber },
    });
    return id;
  }

  async updateBill(id: string, input: BillUpdateInput): Promise<void> {
    await apiFetch(`/api/admin/bills/${encodeURIComponent(id)}`, { method: "PUT", body: input });
  }

  async deleteBill(id: string): Promise<void> {
    await apiFetch(`/api/admin/bills/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async updateBillStatus(id: string, status: BillStatus): Promise<void> {
    await apiFetch(`/api/admin/bills/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status },
    });
  }
}

export const billingService = new BillingService();
