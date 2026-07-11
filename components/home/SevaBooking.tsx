"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { X, Copy, Check } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { poojaService } from "@/services/pooja.service";
import { sevaBookingService } from "@/services/sevaBooking.service";
import { DailyPooja } from "@/types/pooja";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SevaReceipt from "./SevaReceipt";

export default function SevaBooking() {
  const { user, profile, loading } = useAuth();
  const { upiEnabled, upiDetails } = useFinanceSettings();
  const [poojas, setPoojas] = useState<DailyPooja[]>([]);
  const [selectedSeva, setSelectedSeva] = useState<DailyPooja | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [bookingRef, setBookingRef] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [showPaymentRefForm, setShowPaymentRefForm] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loadingSevas, setLoadingSevas] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    receiptNumber: string;
    devoteeName: string;
    phone: string;
    sevaDate: string;
    sevaTitle: string;
    sevaAmount: number;
    paymentReference: string;
  } | null>(null);

  useEffect(() => {
    async function loadSevas() {
      setLoadingSevas(true);
      try {
        const data = await poojaService.getPoojas();
        setPoojas(
          data.filter(
            (item) => item.isActive && item.sevaAmount > 0
          )
        );
      } catch (error) {
        console.error("Failed to load sevas:", error);
      } finally {
        setLoadingSevas(false);
      }
    }

    loadSevas();
  }, []);

  useEffect(() => {
     
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(profile.name || "");
       
      setEmail(profile.email || "");
       
      setPhone(profile.phone || "");
    } else if (user) {
       
      setEmail(user.email || "");
    }
  }, [profile, user]);

  useEffect(() => {
    if (paymentInitiated && countdown > 0 && !showPaymentRefForm) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (paymentInitiated && countdown === 0 && !showPaymentRefForm) {
      // After countdown, show payment reference form
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPaymentRefForm(true);
    }
  }, [paymentInitiated, countdown, showPaymentRefForm]);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
    toast.success("Copied to clipboard!");
  }

  function openUPIApp() {
    if (!selectedSeva) return;
    const upiId = upiDetails?.id || "9886364462@ptsbi";
    
    // Don't try to open UPI URL in browser - it causes blank page
    // Instead, copy UPI ID to clipboard so user can paste in their UPI app
    navigator.clipboard.writeText(upiId);
    toast.success('UPI ID copied! Open your UPI app, paste and pay.');
    
    // Start countdown to show receipt after 5 seconds
    setPaymentInitiated(true);
  }

  const availableSevas = poojas;

  function handleSubmitClick() {
    if (!user) {
      toast.error("Please sign in to book a seva.");
      return;
    }

    if (!selectedSeva) {
      toast.error("Select a seva to book.");
      return;
    }

    if (!preferredDate) {
      toast.error("Please choose a preferred date.");
      return;
    }

    setShowConfirmDialog(true);
  }

  async function handleBooking() {
    if (!user || !selectedSeva) return;

    setSubmitting(true);

    try {
      const ref = `SVA-${Date.now().toString(36).toUpperCase()}`;
      setBookingRef(ref);
      
      const newBookingId = await sevaBookingService.createBooking({
        sevaId: selectedSeva.id,
        sevaTitle: selectedSeva.title,
        sevaAmount: selectedSeva.sevaAmount,
        userId: user.uid,
        userName: name || profile?.name || "",
        userEmail: email || user.email || "",
        userPhone: phone,
        preferredDate,
        notes,
      });

      setBookingId(newBookingId);
      setShowConfirmDialog(false);
      setShowPaymentDialog(true);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Could not submit booking.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePaymentReference() {
    if (!bookingId || !paymentReference.trim()) {
      toast.error("Please enter your payment reference/transaction ID.");
      return;
    }

    setSavingPayment(true);

    try {
      await sevaBookingService.updatePayment(bookingId, {
        paymentReference: paymentReference.trim(),
        paymentStatus: "completed",
        paymentMethod: "UPI",
      });

      // Set receipt data before closing payment dialog
      setReceiptData({
        receiptNumber: bookingRef,
        devoteeName: name || profile?.name || "",
        phone: phone,
        sevaDate: preferredDate,
        sevaTitle: selectedSeva?.title || "",
        sevaAmount: selectedSeva?.sevaAmount || 0,
        paymentReference: paymentReference.trim(),
      });

      // Show receipt instead of closing
      setShowPaymentDialog(false);
      setShowReceipt(true);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Could not save payment reference.");
    } finally {
      setSavingPayment(false);
    }
  }

  function handleReceiptClose() {
    setShowReceipt(false);
    setReceiptData(null);
    handlePaymentDone();
  }

  function handlePaymentDone() {
    setSelectedSeva(null);
    setPreferredDate("");
    setNotes("");
    setName("");
    setEmail("");
    setPhone("");
    setShowPaymentDialog(false);
    setPaymentInitiated(false);
    setShowPaymentRefForm(false);
    setPaymentReference("");
    setCountdown(5);
    setBookingId("");
    toast.success("Booking completed! Thank you for your contribution.");
  }

  return (
    <>
    <div className="space-y-8">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900">
              Devotee Seva Booking
            </h2>
            <p className="mt-2 text-stone-600">
              Choose from available temple sevas, then submit your booking
              request.
            </p>
          </div>

          {!loading && !user ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-5 py-3 text-white transition hover:bg-orange-700">
                Sign in
              </Link>
              <Link href="/register" className="inline-flex items-center justify-center rounded-lg border border-orange-600 px-5 py-3 text-orange-600 transition hover:bg-orange-50">
                Register
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1.2fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-stone-900">
                Available Sevas
              </h3>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
                {availableSevas.length} options
              </span>
            </div>

            {loadingSevas ? (
              <div className="mt-6 text-stone-600">Loading sevas...</div>
            ) : availableSevas.length === 0 ? (
              <div className="mt-6 text-stone-600">
                No seva offerings are available for online booking yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {availableSevas.map((seva) => (
                  <button
                    key={seva.id}
                    type="button"
                    onClick={() => {
                      setSelectedSeva(seva);
                      setPreferredDate("");
                    }}
                    className={`rounded-3xl border p-5 text-left transition ${
                      selectedSeva?.id === seva.id
                        ? "border-orange-500 bg-orange-50"
                        : "border-stone-200 bg-white hover:border-orange-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-lg font-semibold text-stone-900">
                        {seva.title}
                      </h4>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
                        ₹{seva.sevaAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stone-600">
                      {seva.description}
                    </p>
                    <p className="mt-4 text-sm text-stone-500">
                      {seva.category} seva · {seva.duration}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-stone-900">
              Booking Details
            </h3>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Complete the form to send your seva booking request to the temple office.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm text-stone-500">Selected Seva</p>
                <p className="mt-2 text-base font-medium text-stone-900">
                  {selectedSeva ? selectedSeva.title : "Select a seva above"}
                </p>
              </div>

              <Input
                label="Your Name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name for booking"
              />

              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
              />

              <Input
                label="Phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
              />

              <Input
                label="Preferred Date"
                type="date"
                value={preferredDate}
                onChange={(event) => setPreferredDate(event.target.value)}
              />

              <Textarea
                label="Message"
                placeholder="Any special requests, additional Sankalpa details, or notes for the temple"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
              />

              <Button
                type="button"
                onClick={handleSubmitClick}
                loading={submitting}
                disabled={loading || !user}
                className="w-full"
              >
                Submit Booking Request
              </Button>

              {!loading && !user ? (
                <p className="text-sm text-stone-600">
                  Sign in to submit a seva booking request. New devotees can register and start booking instantly.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-orange-50 p-5 text-orange-900 shadow-sm">
            <h4 className="text-lg font-semibold">Need help?</h4>
            <p className="mt-2 text-sm leading-6">
              For urgent seva bookings or group requests, please contact the temple office.
            </p>
          </div>
        </aside>
      </div>
    </div>

    {/* Seva Confirmation Dialog - React Modal */}
    {showConfirmDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="absolute inset-0 bg-black/50"
          onClick={() => setShowConfirmDialog(false)}
        />
        <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-orange-800">
                {selectedSeva?.title}
              </h2>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="p-2 hover:bg-stone-100 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-orange-50 border border-orange-200 p-6">
                <h3 className="text-lg font-bold text-orange-900 mb-4">Important Seva Guidelines</h3>
                <ul className="space-y-3 text-sm text-stone-700">
                  <li className="flex gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span><strong>Advance Booking:</strong> All Sevas must be booked at least two days in advance.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span><strong>Ekadasi Rule:</strong> No Pooja or Seva is performed on Ekadasi.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span><strong>Attendance:</strong> Sevakartas must be present at the Mutt premises for Sankalpa and Seva/Pooja.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span><strong>Seva Timings:</strong> Please call the Mutt one day prior to confirm exact timings.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span><strong>Cancellation:</strong> Seva once booked cannot be cancelled.</span>
                  </li>
                </ul>
              </div>

              <div className="text-center">
                <p className="text-lg font-semibold text-stone-800">
                  Seva Fee: <span className="text-orange-700">₹{selectedSeva?.sevaAmount?.toLocaleString("en-IN")}</span>
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleBooking}
                  loading={submitting}
                >
                  Confirm Booking
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Payment Dialog - React Modal */}
    {showPaymentDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="absolute inset-0 bg-black/50"
          onClick={handlePaymentDone}
        />
        <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-green-800">
                {showPaymentRefForm ? "Confirm Payment" : paymentInitiated ? "Receipt" : "Payment Required"}
              </h2>
              <button
                onClick={handlePaymentDone}
                className="p-2 hover:bg-stone-100 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
                <p className="text-sm text-green-700 mb-2">Booking Reference</p>
                <p className="text-2xl font-bold text-green-800">{bookingRef}</p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white">
                <div className="border-b p-4">
                  <h3 className="font-semibold text-stone-800">Seva Details</h3>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Seva:</span>
                    <span className="font-medium">{selectedSeva?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Date:</span>
                    <span className="font-medium">{preferredDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Devotee:</span>
                    <span className="font-medium">{name || profile?.name}</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Amount:</span>
                    <span className="text-green-700">₹{selectedSeva?.sevaAmount?.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>

              {/* Payment Reference Form - shown after countdown */}
              {showPaymentRefForm ? (
                <div className="rounded-2xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-6">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-green-800 mb-2">Payment Initiated!</h3>
                    <p className="text-green-700">
                      Please enter your UPI transaction ID to confirm payment.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        UPI Transaction ID / Reference Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g., NPS551234567890 or Gpay transaction ID"
                      />
                      <p className="text-xs text-stone-500 mt-1">
                        Find this in your UPI app&apos;s transaction history
                      </p>
                    </div>

                    <Button
                      onClick={handleSavePaymentReference}
                      loading={savingPayment}
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={!paymentReference.trim()}
                    >
                      Confirm Payment
                    </Button>
                  </div>
                </div>
              ) : !paymentInitiated && upiEnabled && upiDetails?.id ? (
                <div className="rounded-2xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-6">
                  <h3 className="text-lg font-bold text-green-800 mb-4">Pay via UPI</h3>
                  
                  <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-200 mb-4">
                    <div>
                      <p className="font-semibold text-stone-900">{upiDetails.id}</p>
                      <p className="text-sm text-stone-500">{upiDetails.displayName}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(upiDetails.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                    >
                      {copiedUpi ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                  </div>

                  <Button
                    onClick={openUPIApp}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy UPI ID &amp; Pay ₹{selectedSeva?.sevaAmount?.toLocaleString("en-IN")}
                  </Button>

                  <p className="text-center text-sm text-stone-500 mt-3">
                    Tap the button to copy UPI ID, then open your UPI app and paste
                  </p>
                </div>
              ) : paymentInitiated ? (
                <div className="rounded-2xl border-2 border-green-400 bg-gradient-to-br from-green-100 to-emerald-100 p-6 text-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-green-800 mb-2">Payment Initiated!</h3>
                  <p className="text-green-700 mb-4">
                    Please complete the payment in your UPI app.
                  </p>
                  <div className="bg-white rounded-lg p-4 mb-4">
                    <p className="text-sm text-stone-600 mb-1">Entering transaction ID in</p>
                    <p className="text-4xl font-bold text-green-600">{countdown}</p>
                    <p className="text-sm text-stone-600">seconds</p>
                  </div>
                  <p className="text-xs text-stone-500">
                    After paying, you will need to enter your transaction ID.
                  </p>
                </div>
              ) : null}

              {!upiEnabled && !paymentInitiated && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-amber-800">Please contact the temple for payment instructions.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Receipt Modal */}
    {showReceipt && receiptData && (
      <SevaReceipt
        receiptNumber={receiptData.receiptNumber}
        date={new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        devoteeName={receiptData.devoteeName}
        phone={receiptData.phone}
        sevaDate={receiptData.sevaDate}
        sevaTitle={receiptData.sevaTitle}
        sevaAmount={receiptData.sevaAmount}
        paymentReference={receiptData.paymentReference}
        onClose={handleReceiptClose}
      />
    )}
    </>
  );
}
