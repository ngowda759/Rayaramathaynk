"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { billingService } from "@/services/billing.service";
import { BillItem, BillCreateInput } from "@/types/billing";
import { defaultFinanceSettings, FinanceSettings } from "@/types/finance";

const SETTINGS_DOC = "financeSettings";
const SETTINGS_COLLECTION = "settings";

export default function CreateBillPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<FinanceSettings>(defaultFinanceSettings);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const due = new Date();
    due.setDate(due.getDate() + 15);
    return due.toISOString().split("T")[0];
  });
  const [items, setItems] = useState<Omit<BillItem, "id">[]>([
    { description: "", quantity: 1, rate: 0, amount: 0 },
  ]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        if (!db) return;
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({ ...defaultFinanceSettings, ...data } as FinanceSettings);
          
          // Set default due date based on settings
          if (data.billing?.defaultDueDays) {
            const due = new Date();
            due.setDate(due.getDate() + data.billing.defaultDueDays);
            setDueDate(due.toISOString().split("T")[0]);
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    }
    loadSettings();
  }, []);

  function addItem() {
    setItems([...items, { description: "", quantity: 1, rate: 0, amount: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      toast.error("At least one item is required.");
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof Omit<BillItem, "id" | "amount">, value: string | number) {
    const newItems = [...items];
    const item = { ...newItems[index] };
    
    if (field === "quantity" || field === "rate") {
      item[field] = Number(value) || 0;
      item.amount = item.quantity * item.rate;
    } else if (field === "description") {
      item.description = value as string;
    }
    
    newItems[index] = item;
    setItems(newItems);
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = subtotal - discountAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error("Customer name is required.");
      return;
    }

    const validItems = items.filter((item) => item.description.trim() && item.rate > 0);
    if (validItems.length === 0) {
      toast.error("At least one item with description and rate is required.");
      return;
    }

    setLoading(true);

    try {
      const input: BillCreateInput = {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        customerGstin: customerGstin.trim() || undefined,
        billDate: new Date(billDate),
        dueDate: new Date(dueDate),
        items: validItems,
        discountAmount,
        notes: notes.trim() || undefined,
      };

      const invoicePrefix = settings.billing?.invoicePrefix || "INV";
      const invoiceNumber = settings.billing?.invoiceNumber || 1001;

      await billingService.createBill(input, invoicePrefix, invoiceNumber);
      toast.success("Bill created successfully!");
      router.push(`/admin/billing`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create bill. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/billing"
          className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <AdminPageHeader
          title="Create Bill"
          description="Create a new invoice/bill for a customer."
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900 mb-4">Customer Details</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Customer Name *
              </label>
              <Input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Phone
              </label>
              <Input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                GSTIN
              </label>
              <Input
                type="text"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Address
              </label>
              <textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Enter customer address"
                rows={2}
                className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900 mb-4">Bill Details</h3>
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Bill Date *
              </label>
              <Input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Due Date *
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 text-sm font-medium text-stone-500">
              <div className="col-span-5">Description</div>
              <div className="col-span-2">Quantity</div>
              <div className="col-span-2">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>

            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-end">
                <div className="col-span-5">
                  <Input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Service or product description"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    min="1"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={item.rate}
                    onChange={(e) => updateItem(index, "rate", e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="col-span-2 text-right font-medium text-stone-900">
                  ₹{item.amount.toLocaleString("en-IN")}
                </div>
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 py-3 text-sm text-stone-500 hover:border-purple-400 hover:text-purple-600"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>

          {/* Totals */}
          <div className="mt-6 border-t pt-6">
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-600">Discount</span>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400">₹</span>
                    <Input
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                      min="0"
                      className="w-28 text-right"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-lg font-semibold text-stone-900 border-t pt-2">
                  <span>Total</span>
                  <span>₹{totalAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900 mb-4">Additional Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes or terms..."
            rows={3}
            className="w-full rounded-lg border border-stone-300 px-4 py-2 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          />
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/admin/billing">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Creating..." : "Create Bill"}
          </Button>
        </div>
      </form>
    </div>
  );
}
