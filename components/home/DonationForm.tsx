"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { donationService } from "@/services/donation.service";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function DonationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Online");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name || !email || !phone || !amount) {
      toast.error("Please complete all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      await donationService.createDonation({
        name,
        email,
        phone,
        amount: Number(amount),
        message,
        paymentMethod,
      });

      toast.success("Donation request submitted. Thank you!");
      setName("");
      setEmail("");
      setPhone("");
      setAmount("");
      setMessage("");
      setPaymentMethod("Online");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Unable to submit donation.");
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
        Give online, and we will follow up with payment details.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label="Amount (₹)"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-700">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            >
              <option>Online</option>
              <option>Bank Transfer</option>
              <option>Cash</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-700">
              Message (optional)
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <Button type="submit" loading={submitting}>
          Submit Donation
        </Button>
      </form>
    </div>
  );
}
