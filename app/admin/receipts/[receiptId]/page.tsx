"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Phone, Mail, MapPin, ReceiptText, Printer, Download } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { receiptService } from "@/services/receipt.service";
import { Receipt } from "@/types/receipt";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReceipt() {
      if (!user || !params.id) return;
      try {
        const token = await user.getIdToken();
        const data = await receiptService.getReceipt(params.id as string, token);
        setReceipt(data);
      } catch (error) {
        console.error("Failed to load receipt:", error);
        toast.error("Failed to load receipt");
      } finally {
        setLoading(false);
      }
    }
    loadReceipt();
  }, [user, params.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="text-stone-500">Receipt not found</p>
        <Link href="/admin/receipts" className="mt-4 inline-block text-orange-600 hover:underline">
          Back to Receipts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/receipts"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <AdminPageHeader
            title={`Receipt ${receipt.receiptNumber}`}
            description="Receipt details for temple records."
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/admin/receipts/${receipt.id}/print`)}
          >
            <Printer className="mr-2 h-4 w-4" />Print Receipt
          </Button>
          <Button
            variant="outline"
            loading={downloading}
            onClick={async () => {
              if (!user) return;
              try {
                setDownloading(true);
                const token = await user.getIdToken();
                const blob = await receiptService.getReceiptPdf(receipt.id, token);
                const url = window.URL.createObjectURL(blob);
                const a = window.document.createElement("a");
                a.href = url;
                a.download = `${receipt.receiptNumber}.pdf`;
                window.document.body.appendChild(a);
                a.click();
                window.document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
              } catch {
                toast.error("Failed to download PDF");
              } finally {
                setDownloading(false);
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />Download PDF
          </Button>
          <Button variant="outline" onClick={() => router.push("/admin/receipts/create")}>
            New Receipt
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b border-stone-200 px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                <ReceiptText className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-mono text-lg font-bold text-orange-600">{receipt.receiptNumber}</p>
                <p className="text-sm text-stone-500">
                  Issued {receipt.createdAt ? new Date(receipt.createdAt).toLocaleString() : "-"}
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              UPI
            </span>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Devotee</h3>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-stone-700">
                <User className="h-4 w-4 text-stone-400" />
                <span className="font-medium">{receipt.devoteeName}</span>
              </p>
              {receipt.devoteePhone && (
                <p className="flex items-center gap-2 text-stone-600">
                  <Phone className="h-4 w-4 text-stone-400" />
                  {receipt.devoteePhone}
                </p>
              )}
              {receipt.devoteeEmail && (
                <p className="flex items-center gap-2 text-stone-600">
                  <Mail className="h-4 w-4 text-stone-400" />
                  {receipt.devoteeEmail}
                </p>
              )}
              {receipt.devoteeAddress && (
                <p className="flex items-center gap-2 text-stone-600">
                  <MapPin className="h-4 w-4 text-stone-400" />
                  {receipt.devoteeAddress}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Payment</h3>
            <div className="space-y-2 text-sm">
              <p className="flex items-center justify-between text-stone-600">
                <span>Payment Mode</span>
                <span className="font-medium text-green-700">UPI</span>
              </p>
              {receipt.paymentReference && (
                <p className="text-stone-600">
                  <span className="text-stone-400">Reference:</span> <span className="font-mono">{receipt.paymentReference}</span>
                </p>
              )}
              {receipt.notes && (
                <p className="text-stone-600">
                  <span className="text-stone-400">Notes:</span> {receipt.notes}
                </p>
              )}
              <p className="text-xs text-stone-400">Created by {receipt.createdBy}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border-t border-stone-200">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Seva</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Rate</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Qty</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {receipt.items.map((item, index) => (
                <tr key={`${item.sevaId}-${index}`}>
                  <td className="px-6 py-3 text-sm font-medium text-stone-800">{item.sevaName}</td>
                  <td className="px-6 py-3 text-right text-sm text-stone-600">{formatCurrency(item.rate)}</td>
                  <td className="px-6 py-3 text-right text-sm text-stone-600">{item.quantity}</td>
                  <td className="px-6 py-3 text-right text-sm font-medium text-stone-800">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-stone-200 px-6 py-5">
          <div className="ml-auto w-full max-w-xs space-y-2">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>Subtotal</span>
              <span>{formatCurrency(receipt.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-stone-200 pt-2 text-lg font-semibold text-stone-900">
              <span>Total</span>
              <span className="text-orange-600">{formatCurrency(receipt.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}