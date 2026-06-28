"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

import { useAuth } from "@/hooks/useAuth";
import { poojaService } from "@/services/pooja.service";
import { sevaService } from "@/services/seva.service";
import { DailyPooja } from "@/types/pooja";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function SevaBooking() {
  const { user, profile, loading } = useAuth();
  const [poojas, setPoojas] = useState<DailyPooja[]>([]);
  const [selectedSeva, setSelectedSeva] = useState<DailyPooja | null>(
    null
  );
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loadingSevas, setLoadingSevas] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      setName(profile.name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
    } else if (user) {
      setEmail(user.email || "");
    }
  }, [profile, user]);

  const availableSevas = poojas;

  async function handleBooking() {
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

    setSubmitting(true);

    try {
      await sevaService.createBooking({
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

      toast.success(
        "Booking request submitted. The temple will contact you soon."
      );
      setSelectedSeva(null);
      setPreferredDate("");
      setNotes("");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Could not submit booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
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
                label="Notes"
                placeholder="Any special requests or puja details"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
              />

              <Button
                type="button"
                onClick={handleBooking}
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
  );
}
