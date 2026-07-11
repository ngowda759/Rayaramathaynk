"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Eye, Trash2, Send, CheckCircle, Clock, AlertTriangle, XCircle, FileText, Settings } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import { Button } from "@/components/ui/button";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";
import { billingService } from "@/services/billing.service";
import { Bill, BillStatus } from "@/types/billing";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

const SETTINGS_DOC = "financeSettings";
const SETTINGS_COLLECTION = "settings";

function BillingPageContent() {
  const router = useRouter();
  useFinanceSettings(); // Initialize finance settings
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillStatus | "all">("all");
  const [billingEnabled, setBillingEnabled] = useState(false);
  const loadBills = useCallback(async () => {
    try {
      setLoading(true);
      const data = await billingService.getBills();
      setBills(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load bills.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
     
    async function loadBillingStatus() {
      try {
        if (!db) {
          setLoading(false);
          return;
        }
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBillingEnabled(data.billingEnabled ?? false);
          if (data.billingEnabled) {
            await loadBills();
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading billing status:", error);
        setLoading(false);
      }
    }
    loadBillingStatus();
  }, []);

  const filteredBills = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    return bills.filter((bill) => {
      const matchesSearch =
        !keyword ||
        [
          bill.invoiceNumber,
          bill.customerName,
          bill.customerEmail,
          bill.customerPhone,
        ].some((value) => value?.toLowerCase().includes(keyword));
      const matchesStatus = statusFilter === "all" || bill.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bills, search, statusFilter]);
  async function handleDelete(bill: Bill) {
    if (!window.confirm(`Delete bill ${bill.invoiceNumber}?`)) {
      return;
    }
    try {
      await billingService.deleteBill(bill.id);
      toast.success("Bill deleted.");
      await loadBills();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete bill.");
    }
  }
  async function handleSendBill(bill: Bill) {
    try {
      await billingService.updateBillStatus(bill.id, "sent");
      toast.success("Bill sent to customer.");
      await loadBills();
    } catch (error) {
      console.error(error);
      toast.error("Failed to send bill.");
    }
  }
  const stats = useMemo(() => {
    const total = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    const paid = bills
      .filter((b) => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + b.totalAmount, 0);
    const pending = bills
      .filter((b) => b.paymentStatus === "pending" || b.paymentStatus === "partial")
      .reduce((sum, b) => sum + b.balanceDue, 0);
    const overdue = bills
      .filter((b) => b.status === "sent" && b.balanceDue > 0)
      .reduce((sum, b) => sum + b.balanceDue, 0);
    return { total, paid, pending, overdue, count: bills.length };
  }, [bills]);
  const getStatusBadge = (status: BillStatus) => {
    const styles: Record<BillStatus, { bg: string; text: string; icon: any }> = {
      draft: { bg: "bg-stone-100 text-stone-700", text: "Draft", icon: FileText },
      sent: { bg: "bg-blue-100 text-blue-700", text: "Sent", icon: Send },
      paid: { bg: "bg-green-100 text-green-700", text: "Paid", icon: CheckCircle },
      partial: { bg: "bg-yellow-100 text-yellow-700", text: "Partial", icon: Clock },
      overdue: { bg: "bg-orange-100 text-orange-700", text: "Overdue", icon: AlertTriangle },
      cancelled: { bg: "bg-red-100 text-red-700", text: "Cancelled", icon: XCircle },
    };
    const style = styles[status] || styles.draft;
    const Icon = style.icon;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
        <Icon className="h-3 w-3" />
        {style.text}
      </span>
    );
  };
  const formatDate = (date: any) => {
    if (!date) return "-";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  if (!billingEnabled) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Billing"
          description="Create and manage invoices, bills and receipts."
        />
        <div className="rounded-xl border bg-white p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
            <FileText className="h-8 w-8 text-purple-600" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-stone-900">Billing Module Disabled</h2>
          <p className="mt-2 text-stone-500">
            The billing module is currently disabled. Enable it in Finance Settings to start creating bills.
          </p>
          <Link href="/admin/settings/finance">
            <Button className="mt-6 bg-purple-600 hover:bg-purple-700">
              <Settings className="mr-2 h-4 w-4" />
              Go to Finance Settings
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title="Billing"
          description="Create and manage invoices, bills and receipts."
        />
        <div className="flex gap-3">
          <Link href="/admin/billing/settings">
            <Button variant="outline" className="border-purple-200 text-purple-600 hover:bg-purple-50">
              <Settings className="mr-2 h-4 w-4" />
              Billing Settings
            </Button>
          </Link>
          <Link href="/admin/billing/create">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Bill
            </Button>
          </Link>
        </div>
      </div>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">Total Bills</p>
          <h2 className="mt-2 text-2xl font-bold">{stats.count}</h2>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">Total Amount</p>
          <h2 className="mt-2 text-2xl font-bold">{formatCurrency(stats.total)}</h2>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">Amount Collected</p>
          <h2 className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(stats.paid)}</h2>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">Pending</p>
          <h2 className="mt-2 text-2xl font-bold text-yellow-600">{formatCurrency(stats.pending)}</h2>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-stone-500">Overdue</p>
          <h2 className="mt-2 text-2xl font-bold text-red-600">{formatCurrency(stats.overdue)}</h2>
        </div>
      </div>
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search by invoice number, customer name, email or phone..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BillStatus | "all")}
          className="rounded-xl border border-stone-300 bg-white px-4 py-3"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {/* Bills Table */}
      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          Loading bills...
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-stone-500">No bills found.</p>
          <Link href="/admin/billing/create" className="mt-4 inline-block">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Bill
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    Invoice #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-stone-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-stone-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-sm font-medium text-purple-600">
                        {bill.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-stone-900">{bill.customerName}</p>
                        {bill.customerEmail && (
                          <p className="text-sm text-stone-500">{bill.customerEmail}</p>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                      {formatDate(bill.billDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-stone-600">
                      {formatDate(bill.dueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-stone-900">
                      {formatCurrency(bill.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span className={bill.balanceDue > 0 ? "font-medium text-red-600" : "text-green-600"}>
                        {formatCurrency(bill.balanceDue)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {getStatusBadge(bill.status)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/admin/billing/${bill.id}`)}
                          className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {bill.status === "draft" && (
                          <button
                            onClick={() => handleSendBill(bill)}
                            className="rounded-lg p-2 text-blue-400 hover:bg-blue-50 hover:text-blue-600"
                            title="Send Bill"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(bill)}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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

export default function BillingPage() {
  return (
    <AdminAuthGuard requiredPermission="billing">
      <BillingPageContent />
    </AdminAuthGuard>
  );
}
