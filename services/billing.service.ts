import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  orderBy,
  Timestamp,
  DocumentSnapshot,
  FieldValue,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Bill,
  BillCreateInput,
  BillUpdateInput,
  BillItem,
  BillPayment,
  BillStatus,
  PaymentStatus,
} from "@/types/billing";

const COLLECTION = "bills";

function docToBill(docSnap: DocumentSnapshot): Bill {
  const data = docSnap.data();
  if (!data) {
    throw new Error("Bill document data is undefined");
  }
  return {
    id: docSnap.id,
    invoiceNumber: data.invoiceNumber || "",
    billDate: data.billDate,
    dueDate: data.dueDate,
    customerName: data.customerName || "",
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    customerAddress: data.customerAddress,
    customerGstin: data.customerGstin,
    items: data.items || [],
    subtotal: data.subtotal || 0,
    taxAmount: data.taxAmount || 0,
    discountAmount: data.discountAmount || 0,
    totalAmount: data.totalAmount || 0,
    amountPaid: data.amountPaid || 0,
    balanceDue: data.balanceDue || 0,
    status: data.status || "draft",
    paymentStatus: data.paymentStatus || "pending",
    payments: data.payments || [],
    notes: data.notes,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy || "",
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
    const itemTotal = item.quantity * item.rate;
    subtotal += itemTotal;
    if (item.taxRate && item.taxAmount) {
      taxAmount += item.taxAmount;
    }
  });

  const totalAmount = subtotal + taxAmount - discountAmount;

  return {
    subtotal,
    taxAmount,
    totalAmount,
  };
}

class BillingService {
  async getBills(): Promise<Bill[]> {
    if (!db) throw new Error("Firebase not configured");
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToBill);
  }

  async getBill(id: string): Promise<Bill | null> {
    if (!db) throw new Error("Firebase not configured");
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return docToBill(snap);
  }

  async getBillsByStatus(status: BillStatus): Promise<Bill[]> {
    if (!db) throw new Error("Firebase not configured");
    const q = query(
      collection(db, COLLECTION),
      where("status", "==", status),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToBill);
  }

  async getBillsByCustomer(customerName: string): Promise<Bill[]> {
    if (!db) throw new Error("Firebase not configured");
    const q = query(
      collection(db, COLLECTION),
      where("customerName", "==", customerName),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToBill);
  }

  async getOverdueBills(): Promise<Bill[]> {
    if (!db) throw new Error("Firebase not configured");
    const now = new Date();
    const q = query(
      collection(db, COLLECTION),
      where("status", "in", ["sent", "partial"]),
      where("dueDate", "<", Timestamp.fromDate(now)),
      orderBy("dueDate", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToBill);
  }

  async createBill(
    input: BillCreateInput,
    invoicePrefix: string = "INV",
    invoiceNumber: number = 1
  ): Promise<string> {
    if (!db) throw new Error("Firebase not configured");
    const items: BillItem[] = input.items.map((item) => ({
      ...item,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      amount: item.quantity * item.rate,
      taxAmount: item.taxRate ? (item.quantity * item.rate * item.taxRate) / 100 : 0,
    }));

    const { subtotal, taxAmount, totalAmount } = calculateBillTotals(
      items,
      input.discountAmount || 0
    );

    const billData = {
      invoiceNumber: generateInvoiceNumber(invoicePrefix, invoiceNumber),
      billDate: input.billDate || Timestamp.now(),
      dueDate: input.dueDate || Timestamp.now(),
      customerName: input.customerName,
      customerEmail: input.customerEmail || "",
      customerPhone: input.customerPhone || "",
      customerAddress: input.customerAddress || "",
      customerGstin: input.customerGstin || "",
      items,
      subtotal,
      taxAmount,
      discountAmount: input.discountAmount || 0,
      totalAmount,
      amountPaid: 0,
      balanceDue: totalAmount,
      status: "draft" as BillStatus,
      paymentStatus: "pending" as PaymentStatus,
      payments: [],
      notes: input.notes || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: "",
    };

    const docRef = await addDoc(collection(db, COLLECTION), billData);
    return docRef.id;
  }

  async updateBill(id: string, input: BillUpdateInput): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    const updateData: Partial<Bill> & { updatedAt: FieldValue } = {
      ...input,
      updatedAt: serverTimestamp(),
    };

    // Recalculate totals if items changed
    if (input.items) {
      const items: BillItem[] = input.items.map((item) => ({
        ...item,
        id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
        amount: item.quantity * item.rate,
        taxAmount: item.taxRate ? (item.quantity * item.rate * item.taxRate) / 100 : 0,
      }));

      const { subtotal, taxAmount, totalAmount } = calculateBillTotals(
        items,
        input.discountAmount || 0
      );

      updateData.items = items;
      updateData.subtotal = subtotal;
      updateData.taxAmount = taxAmount;
      updateData.totalAmount = totalAmount;
      updateData.balanceDue = totalAmount - (updateData.amountPaid || 0);
    }

    await updateDoc(doc(db, COLLECTION, id), updateData as Record<string, unknown>);
  }

  async deleteBill(id: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await deleteDoc(doc(db, COLLECTION, id));
  }

  async updateBillStatus(id: string, status: BillStatus): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await updateDoc(doc(db, COLLECTION, id), {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  async addPayment(
    billId: string,
    payment: Omit<BillPayment, "id">
  ): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    const bill = await this.getBill(billId);
    if (!bill) throw new Error("Bill not found");

    const newPayment: BillPayment = {
      ...payment,
      id: Date.now().toString(),
    };

    const newAmountPaid = bill.amountPaid + payment.amount;
    const newBalanceDue = bill.totalAmount - newAmountPaid;

    let paymentStatus: PaymentStatus = "partial";
    if (newBalanceDue <= 0) {
      paymentStatus = "paid";
    }

    let status: BillStatus = bill.status;
    if (status === "draft") {
      status = "sent";
    }

    await updateDoc(doc(db, COLLECTION, billId), {
      payments: [...bill.payments, newPayment],
      amountPaid: newAmountPaid,
      balanceDue: Math.max(0, newBalanceDue),
      paymentStatus,
      status,
      updatedAt: serverTimestamp(),
    });
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
      date: Timestamp.now(),
      method,
      reference,
      notes,
    });
  }
}

export const billingService = new BillingService();
