"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReceiptText, Search, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import SevaReceipt from "@/components/home/SevaReceipt";
import SevaBooking from "@/components/home/SevaBooking";

interface SevaBookingRecord {
  id: string;
  firestore_id?: string;
  user_name: string;
  user_phone: string;
  seva_title: string;
  seva_amount: number;
  payment_reference?: string;
  created_at: string;
  preferred_date?: string;
  gotra?: string;
  nakshatra?: string;
}

export default function PublicReceiptsPage() {
  const [activeTab, setActiveTab] = useState<"search" | "create">("search");

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<SevaBookingRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<SevaBookingRecord | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    if (!searchQuery.trim()) {
      toast.error("Please enter search details");
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const searchParams = new URLSearchParams();
      searchParams.append("search", searchQuery);

      const response = await fetch(`/api/public/receipts?${searchParams.toString()}`);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to search receipts");
      }

      const data = await response.json();
      setReceipts(data.receipts || []);

      if (data.receipts?.length === 0) {
        toast.error("No receipts found matching your criteria.");
      }
    } catch (error) {
      console.error("Error searching receipts:", error);
      toast.error(error instanceof Error ? error.message : "Failed to search receipts");
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }

  function handleViewReceipt(receipt: SevaBookingRecord) {
    setSelectedReceipt(receipt);
  }

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="Seva Receipts"
          subtitle="Search for existing receipts or create a new seva booking."
        />

        <div className="mx-auto max-w-6xl">
          <div className="flex justify-center gap-4 mb-8">
            <Button
              variant={activeTab === "search" ? "primary" : "outline"}
              onClick={() => setActiveTab("search")}
              className={activeTab === "search" ? "bg-orange-600 hover:bg-orange-700" : ""}
            >
              <Search className="mr-2 h-4 w-4" />
              Find Receipt
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
              <div className="rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm mb-8">
                <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-stone-700">
                      Search by Phone, Email, or Booking Reference
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. 9876543210 or devotee@example.com"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Search
                  </Button>
                </form>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
                </div>
              ) : searched && receipts.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-stone-900 mb-4">Search Results ({receipts.length})</h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    {receipts.map((receipt) => (
                      <div key={receipt.id} className="rounded-xl border border-stone-200 bg-white p-5 hover:border-orange-300 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-orange-600">{receipt.firestore_id || receipt.id.slice(0,8)}</p>
                            <p className="text-sm text-stone-500">
                              {new Date(receipt.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            ₹{receipt.seva_amount}
                          </span>
                        </div>

                        <div className="mb-4">
                          <p className="font-medium text-stone-900">{receipt.user_name}</p>
                          <p className="text-sm text-stone-600">
                            {receipt.seva_title}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleViewReceipt(receipt)}
                        >
                          <ReceiptText className="mr-2 h-4 w-4" /> View Receipt
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searched ? (
                <div className="rounded-xl border border-stone-200 bg-white p-12 text-center">
                  <ReceiptText className="mx-auto h-12 w-12 text-stone-300 mb-4" />
                  <h3 className="text-lg font-medium text-stone-900">No receipts found</h3>
                  <p className="text-stone-500 mt-1">Try searching with a different criteria.</p>
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

      {selectedReceipt && (
        <SevaReceipt
          receiptNumber={selectedReceipt.firestore_id || selectedReceipt.id.slice(0, 8)}
          date={new Date(selectedReceipt.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          devoteeName={selectedReceipt.user_name}
          phone={selectedReceipt.user_phone || "-"}
          sevaDate={selectedReceipt.preferred_date || new Date(selectedReceipt.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          sevaTitle={selectedReceipt.seva_title}
          sevaAmount={Number(selectedReceipt.seva_amount)}
          paymentReference={selectedReceipt.payment_reference || "UPI"}
          gotra={selectedReceipt.gotra}
          nakshatra={selectedReceipt.nakshatra}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </>
  );
}
