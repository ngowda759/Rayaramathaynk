"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, CheckCircle2, QrCode, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { receiptSevaService } from "@/services/receiptSeva.service";
import { receiptService } from "@/services/receipt.service";
import { ReceiptSeva } from "@/types/receiptSeva";
import { validateReceiptCreateInput } from "@/lib/receipt/validation";
import { PaymentMode } from "@/types/receipt";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";
import { buildUpiPaymentUrl, DEFAULT_UPI_ID } from "@/lib/receipt/upi";

const PAYMENT_MODE: PaymentMode = "upi";

interface ReceiptItemLine {
  sevaId: string;

  quantity: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CreateReceiptPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [devoteeName, setDevoteeName] = useState("");
  const [devoteePhone, setDevoteePhone] = useState("");
  const [devoteeEmail, setDevoteeEmail] = useState("");
  const [devoteeAddress, setDevoteeAddress] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");

  const [sevas, setSevas] = useState<ReceiptSeva[]>([]);
  const [loadingSevas, setLoadingSevas] = useState(true);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ReceiptItemLine[]>([{ sevaId: "", quantity: 1 }]);
  const [result, setResult] = useState<{ id: string; receiptNumber: string } | null>(null);
const [step, setStep] = useState<"details" | "pay">("details");
const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    async function loadSevas() {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const data = await receiptSevaService.getActiveSevas(token);
        setSevas(data);
      } catch (error) {
        console.error("Failed to load sevas:", error);
        toast.error("Failed to load seva catalogue.");
      } finally {
        setLoadingSevas(false);
      }
    }
    loadSevas();
  }, [user]);

  const sevaById = useMemo(() => {
    const map = new Map<string, ReceiptSeva>();
    sevas.forEach((seva) => map.set(seva.id, seva));
    return map;
  }, [sevas]);

  const computedItems = useMemo(() =>
    items.map((line) => {
      const seva = line.sevaId ? sevaById.get(line.sevaId) : undefined;
      const rate = seva?.amount ?? 0;
      return {
        line,
        seva,
        rate,
        amount: line.quantity * rate,
      };
    })
  , [items, sevaById]);

  const subtotal = computedItems.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal;

  const { upiDetails } = useFinanceSettings();
  const upiUpiId = upiDetails?.id || DEFAULT_UPI_ID;
  const upiPayeeName = upiDetails?.displayName || "Sri Raghavendra Swamy Matha";
  const upiUrl = useMemo(() => buildUpiPaymentUrl({ upiId: upiUpiId, payeeName: upiPayeeName, amount: total, note: "Temple seva receipt" }), [upiUpiId, upiPayeeName, total]);

  useEffect(() => {
    if (step !== "pay") return;
    let cancelled = false;
    async function generateQr() {
      setQrLoading(true);
      try {
        if (typeof window === "undefined") return;
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(upiUrl, { width: 220, margin:  2, color: { dark: "#1c1917", light: "#ffffff" } });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        setQrDataUrl(null);
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    }
    generateQr();
    return () => { cancelled = true; };
  }, [step, upiUrl]);

  function updateItem(index: number, patch: Partial<ReceiptItemLine>) {
    setItems((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addItem() {
    setItems((prev) => [...prev, { sevaId: "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      toast.error("At least one seva is required.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): string[] {
    const errors = validateReceiptCreateInput({
      devoteeName,
      devoteePhone: devoteePhone || undefined,
      devoteeEmail: devoteeEmail || undefined,
      devoteeAddress: devoteeAddress || undefined,
      items,
      paymentMode: PAYMENT_MODE,
    });

    if (errors.length === 0) {
      const missingSeva = items.some((line) => !line.sevaId);
      if (missingSeva) {
        errors.push("Select a seva for each receipt line.");
      }
    }
    return errors;
  }

  function goToPay() {
    const errors = validate();
    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error));
      return;
    }
    setStep("pay");
  }

  async function confirmPayment() {
    if (!user) {
      toast.error("Not authenticated.");
      return;
    }

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const input = {
        devoteeName: devoteeName.trim(),
        devoteePhone: devoteePhone.trim() || undefined,
        devoteeEmail: devoteeEmail.trim() || undefined,
        devoteeAddress: devoteeAddress.trim() || undefined,
        items: items.map((line) => ({ sevaId: line.sevaId, quantity: line.quantity })),
        paymentMode: PAYMENT_MODE,
        paymentReference: paymentReference.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const created = await receiptService.createReceipt(input, token);
      setResult(created);
      setStep("details");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to create receipt.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-stone-900">Receipt Created</h2>
          <p className="mt-2 text-sm text-stone-500">Receipt issued successfully.</p>
          <div className="mt-6 rounded-xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-wider text-stone-400">Receipt Number</p>
            <p className="mt-1 font-mono text-2xl font-bold text-orange-600">{result.receiptNumber}</p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => { setResult(null); resetForm(); }}
            >
              Create Another
            </Button>
            <Button onClick={() => router.push("/admin/receipts")}>
              View All Receipts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function resetForm() {
    setDevoteeName("");
    setDevoteePhone("");
    setDevoteeEmail("");
    setDevoteeAddress("");
    setPaymentReference("");
    setNotes("");
    setItems([{ sevaId: "", quantity: 1 }]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/receipts"
          className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <AdminPageHeader
          title="Create Receipt"
          description="Issue an official seva receipt. Receipt numbers are allocated automatically."
        />
      </div>

      {step === "pay" ? (
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                <QrCode className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Pay via UPI</h2>
                <p className="text-sm text-stone-500">Scan the QR code with any UPI app to pay the exact amount.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-white p-6">
                {qrLoading ? (
                  <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg border border-stone-200 bg-stone-50">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
                  </div>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="UPI payment QR code" width={220} height={220} className="rounded-lg" />
                ) : (
                  <p className="text-sm text-stone-500">Unable to generate QR code.</p>
                )}
                <p className="mt-3 font-mono text-sm text-stone-500">{upiUpiId}</p>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="text-sm text-stone-500">Total Payable</p>
                  <p className="mt-1 text-3xl font-bold text-orange-600">{formatCurrency(total)}</p>
                </div>

                <div className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
                  <p className="font-medium text-stone-700">Payment Instructions:</p>
                  <ol className="mt-2 list-inside list-decimal space-y-1">
                    <li>Scan the QR code or use your UPI app to pay.</li>
                    <li>Enter the exact payable amount if prompted.</li>
                    <li>Enter the UPI transaction ID below once payment completed.</li>
                    <li>Click Confirm Payment to issue the receipt.</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Payment Reference (UPI transaction ID)
                  </label>
                  <Input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="UPI transaction ID (if available)"
                  />
                </div>

                {notes && (
                  <p className="text-sm text-stone-500">Notes: {notes}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setStep("details")}>Back and Edit</Button>
              <Button type="button" loading={loading} onClick={confirmPayment} className="bg-orange-600 hover:bg-orange-700">
                <CheckCircle2 className="mr-2 h-4 w-4" />Confirm Paymentand Issue Receipt
              </Button>
            </div>
          </div>
        </div>
      ) : (
      <form onSubmit={goToPay} className="space-y-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900 mb-4">Devotee Details</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Devotee Name *
              </label>
              <Input
                type="text"
                value={devoteeName}
                onChange={(e) => setDevoteeName(e.target.value)}
                placeholder="Enter devotee name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Mobile
              </label>
              <Input
                type="tel"
                value={devoteePhone}
                onChange={(e) => setDevoteePhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                value={devoteeEmail}
                onChange={(e) => setDevoteeEmail(e.target.value)}
                placeholder="devotee@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Address
              </label>
              <Input
                type="text"
                value={devoteeAddress}
                onChange={(e) => setDevoteeAddress(e.target.value)}
                placeholder="Devotee address (optional)"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-900">Receipt Items</h3>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="border-orange-200 text-orange-600 hover:bg-orange-50">
              <Plus className="mr-1 h-4 w-4" />
              Add Seva
            </Button>
          </div>

          <div className="space-y-4">
            {computedItems.map(({ line, seva, amount }, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end rounded-xl border border-stone-200 p-4 bg-stone-50/50">
                <div className="col-span-12 md:col-span-5">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Seva *
                  </label>
                  {loadingSevas ? (
                    <div className="flex h-10 items-center rounded-lg border border-stone-300 bg-white px-4 text-sm text-stone-400">
                      Loading sevas...
                    </div>
                  ) : (
                    <select
                      value={line.sevaId}
                      onChange={(e) => updateItem(index, { sevaId: e.target.value })}
                      className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Select a seva</option>
                      {sevas.map((seva) => (
                        <option key={seva.id} value={seva.id}>
                          {seva.name} — {formatCurrency(seva.amount)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Quantity
                  </label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(e) => updateItem(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Rate
                  </label>
                  <Input
                    type="text"
                    value={seva ? formatCurrency(seva.amount) : "-"}
                    readOnly
                    className="bg-stone-100 text-stone-500"
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    Amount
                  </label>
                  <Input
                    type="text"
                    value={formatCurrency(amount)}
                    readOnly
                    className="bg-stone-100 font-medium text-stone-700"
                  />
                </div>
                <div className="col-span-12 md:col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove seva ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-end gap-1 border-t border-dashed border-stone-200 pt-4">
            <div className="flex w-full max-w-xs items-center justify-between text-sm">
              <span className="text-stone-500">Subtotal</span>
              <span className="font-medium text-stone-700">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex w-full max-w-xs items-center justify-between text-lg font-semibold">
              <span className="text-stone-700">Total</span>
              <span className="text-orange-600">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-900 mb-4">Payment</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Payment Mode *
              </label>
              <div className="flex h-11 items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 text-sm font-medium text-green-700">
                <span>UPI (QR)</span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs">Only</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Payment Reference (optional)
              </label>
              <Input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="UPI transaction ID (if available)"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for this receipt"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/admin/receipts">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
            <ArrowRight className="mr-2 h-4 w-4" />Reviewand Pay
          </Button>
        </div>
      </form>
      )}
    </div>
  );
}