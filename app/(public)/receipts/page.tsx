"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { ReceiptText, Search, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import SevaBooking from "@/components/home/SevaBooking";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/format";

const LOAD_FAILED = "Could not load your receipts right now. Please try again.";
const NOT_SET = "-";

/** The receipts API answers errors as `{ error: { code, message } }`; older responses used a plain string. */
function apiErrorMessage(body: unknown): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string" && error !== "") return error;
  const message = (error as { message?: unknown } | null | undefined)?.message;
  return typeof message === "string" && message !== "" ? message : LOAD_FAILED;
}

/** One row of GET /api/public/receipts: the caller's own booking, newest first, at most 20. */
interface PublicBookingRow {
  id: string;
  sevaTitle: string;
  preferredDate: string | null;
  status: string | null;
  paymentStatus: string | null;
  amount: number | null;
}

export default function PublicReceiptsPage() {
  const [activeTab, setActiveTab] = useState<"search" | "create">("search");
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<PublicBookingRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const signedInUser = user;
    let cancelled = false;

    async function loadReceipts() {
      setLoading(true);
      try {
        const token = await signedInUser.getIdToken();
        const response = await fetch("/api/public/receipts", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(apiErrorMessage(data));
        }
        const rows = (data as { receipts?: PublicBookingRow[] } | null)?.receipts ?? [];
        if (!cancelled) setReceipts(rows);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : LOAD_FAILED);
          setReceipts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      }
    }

    void loadReceipts();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="Seva Receipts"
          subtitle="See your seva bookings or create a new seva booking."
        />

        <div className="mx-auto max-w-6xl">
          <div className="flex justify-center gap-4 mb-8">
            <Button
              variant={activeTab === "search" ? "primary" : "outline"}
              onClick={() => setActiveTab("search")}
              className={activeTab === "search" ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              <Search className="mr-2 h-4 w-4" />
              My Receipts
            </Button>
            <Button
              variant={activeTab === "create" ? "primary" : "outline"}
              onClick={() => setActiveTab("create")}
              className={activeTab === "create" ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Receipt
            </Button>
          </div>

          {activeTab === "search" ? (
            <div className="mx-auto max-w-4xl">
              {!authLoading && !user ? (
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm mb-8 text-center">
                  <ReceiptText className="mx-auto h-12 w-12 text-stone-300 mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-medium text-stone-900">Sign in to see your seva receipts</h3>
                  <p className="text-stone-500 mt-1 mb-6">
                    Your receipts are private. Sign in with the account you booked with to find them.
                  </p>
                  <div className="flex flex-col justify-center gap-3 sm:flex-row">
                    <Link href="/login" className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-5 py-3 text-white transition hover:bg-orange-700">
                      Sign in
                    </Link>
                    <Link href="/register" className="inline-flex items-center justify-center rounded-lg border border-orange-600 px-5 py-3 text-orange-600 transition hover:bg-orange-50">
                      Register
                    </Link>
                  </div>
                </div>
              ) : authLoading || loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-600" aria-label="Loading your receipts" />
                </div>
              ) : receipts.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-stone-900 mb-4">Your seva bookings ({receipts.length})</h3>

                  <ul className="grid gap-4 md:grid-cols-2">
                    {receipts.map((receipt) => (
                      <li key={receipt.id} className="rounded-xl border border-stone-200 bg-white p-5 hover:border-orange-300 transition-colors">
                        <div className="flex justify-between items-start gap-3 mb-3">
                          <p className="font-medium text-stone-900">{receipt.sevaTitle || NOT_SET}</p>
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            {receipt.amount === null ? NOT_SET : formatCurrency(receipt.amount)}
                          </span>
                        </div>

                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                          <dt className="text-stone-500">Seva date</dt>
                          <dd className="text-stone-700">{formatDate(receipt.preferredDate) || NOT_SET}</dd>
                          <dt className="text-stone-500">Status</dt>
                          <dd className="text-stone-700">{receipt.status ?? NOT_SET}</dd>
                          <dt className="text-stone-500">Payment</dt>
                          <dd className="text-stone-700">{receipt.paymentStatus ?? NOT_SET}</dd>
                        </dl>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : loaded ? (
                <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
                  <ReceiptText className="mx-auto h-12 w-12 text-stone-300 mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-medium text-stone-900">No receipts yet</h3>
                  <p className="text-stone-500 mt-1">Seva bookings made with this account will appear here.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm">
                <p className="text-lg leading-8 text-stone-700">
                  Fill out the form below to book a new seva. Once payment is complete, a receipt will be automatically generated.
                </p>
              </div>
              <SevaBooking />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
