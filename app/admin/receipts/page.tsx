"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Settings, ReceiptText, Eye } from "lucide-react";
import toast from "react-hot-toast";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { receiptService } from "@/services/receipt.service";
import { Receipt } from "@/types/receipt";
import { formatDate } from "@/lib/format";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ReceiptsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadReceipts = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const data = await receiptService.getReceipts(token);
      setReceipts(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load receipts.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReceipts();
  }, [loadReceipts]);

  const filteredReceipts = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return receipts;
    return receipts.filter((receipt) =>
      [
        receipt.receiptNumber,
        receipt.devoteeName,
        receipt.devoteePhone,
        receipt.devoteeEmail,
      ].some((value) => value?.toLowerCase().includes(keyword))
    );
  }, [receipts, search]);

  const stats = useMemo(() => {
    const totalCount = receipts.length;
    const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.totalAmount, 0);
    const today = new Date().toDateString();
    const todayCount = receipts.filter((receipt) =>
      new Date(receipt.createdAt).toDateString() === today
    ).length;
    const todayAmount = receipts.filter((receipt) =>
      new Date(receipt.createdAt).toDateString() === today
    ).reduce((sum, receipt) => sum + receipt.totalAmount, 0);
    return { totalCount, totalAmount, todayCount, todayAmount };
  }, [receipts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Receipt Book" description="Manage receipt issuance for sevas and offerings." />
        <div className="rounded-xl border bg-white p-8 text-center text-stone-500">
          Loading receipts...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <AdminPageHeader
          title="Receipt Book"
          description="Issue and manage official receipts for temple sevas."
        />
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/receipts/seva-settings">
            <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50">
              <Settings className="mr-2 h-4 w-4" />
              Seva Settings
            </Button>
          </Link>
          <Link href="/admin/receipts/create">
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Receipt
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">Total Receipts</p>
          <h2 className="mt-2 text-2xl font-bold">{stats.totalCount}</h2>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">Total Amount</p>
          <h2 className="mt-2 text-2xl font-bold">{formatCurrency(stats.totalAmount)}</h2>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">Receipts Today</p>
          <h2 className="mt-2 text-2xl font-bold">{stats.todayCount}</h2>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">Collected Today</p>
          <h2 className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(stats.todayAmount)}</h2>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search by receipt number, devotee name, phone or email..."
          />
        </div>
      </div>

      {filteredReceipts.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <ReceiptText className="h-8 w-8 text-orange-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-stone-900">No receipts yet</h2>
          <p className="mt-2 text-stone-500">
            Create your first receipt to start the Receipt Book.
          </p>
          <Link href="/admin/receipts/create" className="mt-6 inline-block">
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Receipt
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Receipt #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Devotee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-stone-500">Payment</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-stone-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-sm font-medium text-orange-600">{receipt.receiptNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-900">{receipt.devoteeName}</p>
                      {receipt.devoteePhone && <p className="text-sm text-stone-500">{receipt.devoteePhone}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                      {receipt.createdAt ? formatDate(receipt.createdAt) : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-600">
                      {receipt.items.length} item{receipt.items.length === 1 ? "" : "s"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-stone-900">
                      {formatCurrency(receipt.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        UPI
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/admin/receipts/${receipt.id}`)}
                        className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                        title="View receipt"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}