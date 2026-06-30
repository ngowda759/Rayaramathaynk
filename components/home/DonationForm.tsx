"use client";

import { useState } from "react";
import toast from "react-hot-toast";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { donationService } from "@/services/donation.service";
import { paymentModeOptions, PaymentMode } from "@/types/donation";

export default function DonationForm() {
  const [donorName, setDonorName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [purpose, setPurpose] = useState("");
  const [campaignId] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const [paymentMode, setPaymentMode] =
    useState<PaymentMode>("cash");

  const [submitting, setSubmitting] =
    useState(false);

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

      toast.success(
        "Donation request submitted successfully."
      );

      setDonorName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setPurpose("");
      setAmount("");
      setMessage("");
      setPaymentMode("cash");
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

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-stone-900">
        Donate to the Temple
      </h2>

      <p className="mt-2 text-stone-600">
        Submit your donation request. Temple
        staff will contact you with payment
        instructions.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6"
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
            onChange={(e) =>
              setAmount(e.target.value)
            }
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
          placeholder="Annadanam, Goshala, Temple Development..."
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
            {paymentModeOptions.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-700">
            Message
          </label>

          <Textarea
            rows={4}
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
          />
        </div>

        <Button
          type="submit"
          loading={submitting}
        >
          Submit Donation Request
        </Button>
      </form>
    </div>
  );
}
