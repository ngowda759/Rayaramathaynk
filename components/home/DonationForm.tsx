"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Copy, Check, ExternalLink, X } from "lucide-react";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { donationService } from "@/services/donation.service";
import { paymentModeOptions, PaymentMode } from "@/types/donation";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";

export default function DonationForm() {
  const { settings, enabled, specialSevas, upiEnabled, bankTransferEnabled, upiDetails, bankDetails } = useFinanceSettings();
  
  const [donorName, setDonorName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [purpose, setPurpose] = useState("");
  const [campaignId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSevaId, setSelectedSevaId] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [donationRef, setDonationRef] = useState("");
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const [paymentMode, setPaymentMode] =
    useState<PaymentMode>("upi");

  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    if (paymentInitiated && countdown > 0) {
       
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (paymentInitiated && countdown === 0) {
      handlePaymentDone();
    }
  }, [paymentInitiated, countdown]);

  function selectSeva(seva: typeof specialSevas[0]) {
    setSelectedSevaId(seva.id);
    setPurpose(seva.title);
    setAmount(seva.amount.toString());
  }

  function copyToClipboard(text: string, type: "upi" | "account") {
    navigator.clipboard.writeText(text);
    if (type === "upi") {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
    toast.success("Copied to clipboard!");
  }

  function openUPIApp() {
    const amountNum = Number(amount);
    const upiId = upiDetails?.id || "9886364462@ptsbi";
    const note = `Donation:${purpose || 'General'}`;
    const upiUrl = `upi://pay?pa=${upiId}&pn=Sri%20Raghavendra%20Swamy%20Matha&am=${amountNum}&cu=INR&tn=${encodeURIComponent(note)}`;
    
    const opened = window.open(upiUrl, '_blank');
    if (!opened || opened.closed) {
      window.location.href = upiUrl;
    }
    
    setPaymentInitiated(true);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !donorName ||
      !email ||
      !phone ||
      !amount
    ) {
      toast.error(
        "Please complete all required fields."
      );
      return;
    }

    setSubmitting(true);

    try {
      const ref = `DON-${Date.now().toString(36).toUpperCase()}`;
      setDonationRef(ref);
      
      await donationService.createDonation({
        donorName,
        email,
        phone,
        address,
        purpose,
        campaignId,
        amount: Number(amount),
        message,
        paymentMode,
      });

      setShowPaymentDialog(true);
    } catch (error: any) {
      console.error(error);

      toast.error(
        error?.message ??
          "Unable to submit donation."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handlePaymentDone() {
    setDonorName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setPurpose("");
    setAmount("");
    setMessage("");
    setSelectedSevaId(null);
    setPaymentMode("upi");
    setShowPaymentDialog(false);
    setPaymentInitiated(false);
    setCountdown(5);
    toast.success("Thank you for your generous donation!");
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm text-center">
        <h2 className="text-2xl font-semibold text-stone-900">Donations Currently Unavailable</h2>
        <p className="mt-2 text-stone-600">The donation feature is temporarily disabled. Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Special Sevas Selection */}
      {specialSevas.length > 0 && (
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">
            Choose Your Seva
          </h2>
          <p className="mt-2 text-stone-600">
            Select a donation purpose or contribute any amount
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {specialSevas.map((seva) => (
              <button
                key={seva.id}
                type="button"
                onClick={() => selectSeva(seva)}
                className={`rounded-xl border-2 p-6 text-left transition-all ${
                  selectedSevaId === seva.id
                    ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                    : "border-stone-200 hover:border-amber-300 hover:bg-stone-50"
                }`}
              >
                <p className="text-lg font-semibold text-stone-900">{seva.title}</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">₹{seva.amount}</p>
                <p className="mt-3 text-sm text-stone-500">{seva.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment Details */}
      {(upiEnabled || bankTransferEnabled) && amount && (
        <div className="rounded-3xl border border-stone-200 bg-gradient-to-br from-amber-50 to-orange-50 p-8 shadow-sm">
          <h3 className="text-xl font-semibold text-stone-900 mb-4">Make Payment</h3>
          
          <div className="grid gap-6 md:grid-cols-2">
            {upiEnabled && upiDetails.id && (
              <div className="rounded-xl border border-green-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-700">UPI Payment</span>
                  <button
                    onClick={() => copyToClipboard(upiDetails.id, "upi")}
                    className="text-green-600 hover:text-green-800"
                  >
                    {copiedUpi ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-lg font-semibold text-stone-900">{upiDetails.id}</p>
                <p className="text-sm text-stone-500">{upiDetails.displayName}</p>
                <p className="mt-2 text-xs text-stone-400">Pay using any UPI app</p>
              </div>
            )}

            {bankTransferEnabled && bankDetails.accountNumber && (
              <div className="rounded-xl border border-blue-200 bg-white p-4">
                <span className="text-sm font-medium text-blue-700">Bank Transfer</span>
                <div className="mt-2 space-y-1 text-sm">
                  <p><span className="text-stone-500">A/C:</span> <span className="font-medium">{bankDetails.accountNumber}</span></p>
                  <p><span className="text-stone-500">Name:</span> {bankDetails.accountName}</p>
                  <p><span className="text-stone-500">Bank:</span> {bankDetails.bankName}</p>
                  <p><span className="text-stone-500">IFSC:</span> {bankDetails.ifscCode}</p>
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 text-sm text-stone-600">
            After making payment, please fill the form below to confirm your donation.
          </p>
        </div>
      )}

      {/* Donation Form */}
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">
          Confirm Your Donation
        </h2>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full Name"
              required
              value={donorName}
              onChange={(e) =>
                setDonorName(e.target.value)
              }
            />

            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
            />

            <Input
              label="Phone"
              required
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value)
              }
            />

            <Input
              label="Amount (₹)"
              type="number"
              min="1"
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setSelectedSevaId(null);
              }}
            />
          </div>

          <Input
            label="Address"
            value={address}
            onChange={(e) =>
              setAddress(e.target.value)
            }
          />

          <Input
            label="Donation Purpose"
            placeholder="Select or type a purpose..."
            value={purpose}
            onChange={(e) =>
              setPurpose(e.target.value)
            }
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-700">
              Payment Mode
            </label>

            <select
              value={paymentMode}
              onChange={(e) =>
                setPaymentMode(
                  e.target.value as PaymentMode
                )
              }
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              {upiEnabled && <option value="upi">UPI</option>}
              {bankTransferEnabled && <option value="bank_transfer">Bank Transfer</option>}
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-700">
              Message (Optional)
            </label>

            <Textarea
              rows={4}
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              placeholder="Add a message with your donation..."
            />
          </div>

          <Button
            type="submit"
            loading={submitting}
            className="w-full"
          >
            Submit Donation Request
          </Button>
        </form>
      </div>

      {/* Payment Modal */}
      {showPaymentDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={handlePaymentDone}
          />
          
          {/* Modal Content */}
          <div className="relative rounded-2xl bg-white max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-green-800">
                  {paymentInitiated ? "Receipt" : "Payment Required"}
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
                  <p className="text-sm text-green-700 mb-2">Donation Reference</p>
                  <p className="text-2xl font-bold text-green-800">{donationRef}</p>
                </div>

                <div className="rounded-xl border border-stone-200 bg-white">
                  <div className="border-b p-4">
                    <h3 className="font-semibold text-stone-800">Donation Details</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-stone-600">Donor:</span>
                      <span className="font-medium">{donorName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Purpose:</span>
                      <span className="font-medium">{purpose || 'General'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Email:</span>
                      <span className="font-medium">{email}</span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Amount:</span>
                      <span className="text-green-700">₹{Number(amount).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {!paymentInitiated && upiEnabled && upiDetails?.id && (
                  <div className="rounded-2xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-6">
                    <h3 className="text-lg font-bold text-green-800 mb-4">Pay via UPI</h3>
                    
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-200 mb-4">
                      <div>
                        <p className="font-semibold text-stone-900">{upiDetails.id}</p>
                        <p className="text-sm text-stone-500">{upiDetails.displayName}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(upiDetails.id, "upi")}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                      >
                        {copiedUpi ? <Check size={20} /> : <Copy size={20} />}
                      </button>
                    </div>

                    <Button
                      onClick={openUPIApp}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Pay ₹{Number(amount).toLocaleString("en-IN")} via UPI
                    </Button>

                    <p className="text-center text-sm text-stone-500 mt-3">
                      Tap the button to open your UPI payment app
                    </p>
                  </div>
                )}

                {paymentInitiated && (
                  <div className="rounded-2xl border-2 border-green-400 bg-gradient-to-br from-green-100 to-emerald-100 p-6 text-center">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-green-800 mb-2">Payment Initiated!</h3>
                    <p className="text-green-700 mb-4">
                      Please complete the payment in your UPI app.
                    </p>
                    <div className="bg-white rounded-lg p-4 mb-4">
                      <p className="text-sm text-stone-600 mb-1">Redirecting in</p>
                      <p className="text-4xl font-bold text-green-600">{countdown}</p>
                      <p className="text-sm text-stone-600">seconds</p>
                    </div>
                    <p className="text-xs text-stone-500">
                      The temple will verify your payment and send a confirmation.
                    </p>
                  </div>
                )}

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
    </div>
  );
}
