"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ReceiptPrintPage() {
  const params = useParams();
  const { user } = useAuth();
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !params.id) return;
      try {
        const token = await user.getIdToken();
        const data = await receiptService.getReceipt(params.id as string, token);
        if (!cancelled) setReceipt(data);
      } catch {
        if (!cancelled) setReceipt(null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user, params.id]);

  useEffect(() => {
    if (!receipt) return;
    const id = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(id);
  }, [receipt]);

  if (!receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-stone-500">
        Loading receipt...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left:  0; top:  0; width:  100%; }
        }
      `}</style>
      <div className="flex min-h-screen items-start justify-center bg-stone-100 p-8 print:bg-white print:p-0">
        <div className="print-area w-full max-w-3xl rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between border-b border-stone-200 pb-6">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Sri Raghavendra Swamy Matha</h1>
              <p className="text-sm text-stone-500">Temple Receipt</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-bold text-orange-600">{receipt.receiptNumber}</p>
              <p className="mt-1 text-sm text-stone-500">{formatDateTime(receipt.createdAt)}</p>
            </div>
          </div>

          <div className="grid gap-6 py-6 sm:grid-cols-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">Devotee</h2>
              <p className="mt-2 font-medium text-stone-900">{receipt.devoteeName}</p>
              {receipt.devoteePhone && <p className="mt-1 text-sm text-stone-600">{receipt.devoteePhone}</p>}
              {receipt.devoteeEmail && <p className="mt-1 text-sm text-stone-600">{receipt.devoteeEmail}</p>}
              {receipt.devoteeAddress && <p className="mt-1 text-sm text-stone-600">{receipt.devoteeAddress}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm text-stone-500">Payment Mode:</p>
              <p className="font-medium text-green-700">UPI (QR)</p>
              {receipt.paymentReference && (
                <p className="mt-2 text-sm text-stone-500">Reference: {receipt.paymentReference}</p>
              )}
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wider text-stone-400">
                <th className="py-2">Seva</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, index) => (
                <tr key={`${item.sevaId}-${index}`} className="border-b border-stone-100">
                  <td className="py-2 font-medium text-stone-800">{item.sevaName}</td>
                  <td className="py-2 text-right text-stone-600">{formatCurrency(item.rate)}</td>
                  <td className="py-2 text-right text-stone-600">{item.quantity}</td>
                  <td className="py-2 text-right font-medium text-stone-800">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-6 w-full max-w-xs space-y-2">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>Subtotal</span>
              <span>{formatCurrency(receipt.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-stone-200 pt-2 text-lg font-semibold">
              <span className="text-stone-900">Total</span>
              <span className="text-orange-600">{formatCurrency(receipt.totalAmount)}</span>
            </div>
          </div>

          {receipt.notes && (
            <p className="mt-6 border-t border-stone-200 pt-4 text-sm text-stone-500">
              Notes: {receipt.notes}
            </p>
          )}

          <div className="mt-8 border-t border-stone-200 pt-4 text-center text-xs text-stone-400">
            Thank you for your contribution. Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru.
          </div>
        </div>
      </div>
    </>
  );
}
