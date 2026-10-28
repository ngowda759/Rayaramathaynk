import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Bill,
  BillCreateInput,
  BillUpdateInput,
  BillItem,
  BillPayment,
  BillStatus,
  PaymentStatus,
} from "@/types/billing";

const TABLE = "bills";

/**
 * Billing, stored in Supabase `bills`.
 *
 * Reads use the public client; writes use the service-role admin client (`bills` is
 * deny-all under RLS and carries customer contact and payment data). There is no
 * Firestore path.
 */
function rowToBill(row: any): Bill {
  return {
    id: row.firestore_id || row.id,
    invoiceNumber: row.invoice_number || "",
    billDate: row.bill_date,
    dueDate: row.due_date,
    customerName: row.customer_name || "",
    customerEmail: row.customer_email ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    customerAddress: row.customer_address ?? undefined,
    customerGstin: row.customer_gstin ?? undefined,
    items: row.items || [],
    subtotal: Number(row.subtotal ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    amountPaid: Number(row.amount_paid ?? 0),
    balanceDue: Number(row.balance_due ?? 0),
    status: row.status || "draft",
    paymentStatus: row.payment_status || "pending",
    payments: row.payments || [],
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by || "",
  };
}

function generateInvoiceNumber(prefix: string, number: number): string {
  return `${prefix}${String(number).padStart(5, "0")}`;
}

function calculateBillTotals(items: BillItem[], discountAmount: number): {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let taxAmount = 0;

  items.forEach((item) => {
    subtotal += item.quantity * item.rate;
    if (item.taxRate && item.taxAmount) {
      taxAmount += item.taxAmount;
    }
  });

  return { subtotal, taxAmount, totalAmount: subtotal + taxAmount - discountAmount };
}

function withComputedItems(items: Omit<BillItem, "id">[] | BillItem[]): BillItem[] {
  return items.map((item) => ({
    ...item,
    id: (item as BillItem).id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
    amount: item.quantity * item.rate,
    taxAmount: item.taxRate ? (item.quantity * item.rate * item.taxRate) / 100 : 0,
  }));
}

class BillingService {
  async getBills(): Promise<Bill[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not read bills: ${error.message}`);
    return (data ?? []).map(rowToBill);
  }

  async getBill(id: string): Promise<Bill | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("firestore_id", id)
      .maybeSingle();
    if (error) throw new Error(`Could not read bill: ${error.message}`);
    return data ? rowToBill(data) : null;
  }

  async getBillsByStatus(status: BillStatus): Promise<Bill[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not read bills: ${error.message}`);
    return (data ?? []).map(rowToBill);
  }

  async getBillsByCustomer(customerName: string): Promise<Bill[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("customer_name", customerName)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not read bills: ${error.message}`);
    return (data ?? []).map(rowToBill);
  }

  async getOverdueBills(): Promise<Bill[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .in("status", ["sent", "partial"])
      .lt("due_date", new Date().toISOString())
      .order("due_date", { ascending: true });
    if (error) throw new Error(`Could not read overdue bills: ${error.message}`);
    return (data ?? []).map(rowToBill);
  }

  async createBill(
    input: BillCreateInput,
    invoicePrefix: string = "INV",
    invoiceNumber: number = 1
  ): Promise<string> {
    const items = withComputedItems(input.items);
    const { subtotal, taxAmount, totalAmount } = calculateBillTotals(items, input.discountAmount || 0);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        invoice_number: generateInvoiceNumber(invoicePrefix, invoiceNumber),
        bill_date: (input.billDate || new Date()).toISOString(),
        due_date: (input.dueDate || new Date()).toISOString(),
        customer_name: input.customerName,
        customer_email: input.customerEmail || "",
        customer_phone: input.customerPhone || "",
        customer_address: input.customerAddress || "",
        customer_gstin: input.customerGstin || "",
        items,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: input.discountAmount || 0,
        total_amount: totalAmount,
        amount_paid: 0,
        balance_due: totalAmount,
        status: "draft",
        payment_status: "pending",
        payments: [],
        notes: input.notes || "",
        created_by: "",
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create bill: ${error.message}`);
    return data.firestore_id || data.id;
  }

  async updateBill(id: string, input: BillUpdateInput): Promise<void> {
    const update: Record<string, unknown> = {};
    if (input.customerName !== undefined) update.customer_name = input.customerName;
    if (input.customerEmail !== undefined) update.customer_email = input.customerEmail;
    if (input.customerPhone !== undefined) update.customer_phone = input.customerPhone;
    if (input.customerAddress !== undefined) update.customer_address = input.customerAddress;
    if (input.customerGstin !== undefined) update.customer_gstin = input.customerGstin;
    if (input.billDate !== undefined) update.bill_date = input.billDate.toISOString();
    if (input.dueDate !== undefined) update.due_date = input.dueDate.toISOString();
    if (input.notes !== undefined) update.notes = input.notes;
    if (input.status !== undefined) update.status = input.status;
    if (input.paymentStatus !== undefined) update.payment_status = input.paymentStatus;
    if (input.discountAmount !== undefined) update.discount_amount = input.discountAmount;

    if (input.items) {
      const items = withComputedItems(input.items);
      const { subtotal, taxAmount, totalAmount } = calculateBillTotals(items, input.discountAmount || 0);
      update.items = items;
      update.subtotal = subtotal;
      update.tax_amount = taxAmount;
      update.total_amount = totalAmount;
      // `BillUpdateInput` carries no paid amount, so a recompute resets the balance
      // to the new total — the same result the Firestore implementation produced.
      update.balance_due = totalAmount;
    }
    update.updated_at = new Date().toISOString();

    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).update(update).eq("firestore_id", id);
    if (error) throw new Error(`Could not update bill: ${error.message}`);
  }

  async deleteBill(id: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).delete().eq("firestore_id", id);
    if (error) throw new Error(`Could not delete bill: ${error.message}`);
  }

  async updateBillStatus(id: string, status: BillStatus): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("firestore_id", id);
    if (error) throw new Error(`Could not update bill status: ${error.message}`);
  }

  async addPayment(billId: string, payment: Omit<BillPayment, "id">): Promise<void> {
    const bill = await this.getBill(billId);
    if (!bill) throw new Error("Bill not found");

    const newPayment: BillPayment = { ...payment, id: Date.now().toString() };
    const newAmountPaid = bill.amountPaid + payment.amount;
    const newBalanceDue = bill.totalAmount - newAmountPaid;

    const paymentStatus: PaymentStatus = newBalanceDue <= 0 ? "paid" : "partial";
    const status: BillStatus = bill.status === "draft" ? "sent" : bill.status;

    const supabase = createAdminClient();
    const { error } = await supabase
      .from(TABLE)
      .update({
        payments: [...bill.payments, newPayment],
        amount_paid: newAmountPaid,
        balance_due: Math.max(0, newBalanceDue),
        payment_status: paymentStatus,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("firestore_id", billId);
    if (error) throw new Error(`Could not add bill payment: ${error.message}`);
  }

  async recordPayment(
    billId: string,
    amount: number,
    method: BillPayment["method"],
    reference?: string,
    notes?: string
  ): Promise<void> {
    await this.addPayment(billId, {
      amount,
      date: new Date(),
      method,
      reference,
      notes,
    });
  }
}

export const billingService = new BillingService();
