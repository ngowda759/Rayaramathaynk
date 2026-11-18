"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsDocument } from "@/hooks/useSettingsDocument";
import { DEFAULT_FOOTER_SETTINGS } from "@/lib/settings/footer";
import {
  MapPin,
  Phone,
  Mail,
  Send,
  CheckCircle2,
  Navigation,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";

/**
 * Public contact page.
 *
 * Contact details come from the same Supabase-backed footer settings document the
 * site footer reads (`/api/public/settings/footer`), so there is one source of truth
 * and no duplicated contact data. The message form posts to the existing
 * `/api/contact` route.
 */
export default function ContactClient() {
  const { data: contact } = useSettingsDocument(
    "footer",
    DEFAULT_FOOTER_SETTINGS
  );

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Please fill in your name, email and message");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit");
      }

      setSubmitted(true);
      toast.success("Thank you for your message. We will get back to you soon.");
    } catch {
      toast.error("Failed to send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-12">
          <div className="absolute inset-0 opacity-10">
            <div
              className="h-full w-full"
              style={{
                backgroundImage: "url('/images/Hero.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-6">
            <Breadcrumb current="Contact" light />
            <div className="mt-8 text-center">
              <h1 className="text-4xl font-bold text-white md:text-5xl">
                Contact Us
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-amber-100">
                Reach the temple office for seva bookings, donations, event
                details and general enquiries.
              </p>
            </div>
          </div>
        </section>

        <section className="px-6 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
            {/* Contact details */}
            <div>
              <h2 className="text-2xl font-bold text-stone-900">
                Temple Office
              </h2>
              <p className="mt-3 text-stone-600">
                We are happy to help. Reach us by phone, email or visit us in
                person.
              </p>

              <div className="mt-8 space-y-5">
                {contact.address && (
                  <div className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-900">Address</h3>
                      <address className="not-italic mt-1 text-stone-600">
                        {contact.address}
                      </address>
                      {contact.mapUrl && (
                        <a
                          href={contact.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800"
                        >
                          <Navigation className="h-4 w-4" />
                          Get Directions
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {(contact.phone || contact.phone2) && (
                  <div className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-900">Phone</h3>
                      <div className="mt-1 space-y-1">
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone.replace(/\s/g, "")}`}
                            className="block text-stone-600 hover:text-amber-700"
                          >
                            {contact.phone}
                          </a>
                        )}
                        {contact.phone2 && (
                          <a
                            href={`tel:${contact.phone2.replace(/\s/g, "")}`}
                            className="block text-stone-600 hover:text-amber-700"
                          >
                            {contact.phone2}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {contact.email && (
                  <div className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-900">Email</h3>
                      <a
                        href={`mailto:${contact.email}`}
                        className="mt-1 block break-all text-stone-600 hover:text-amber-700"
                      >
                        {contact.email}
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">
                      Office Hours
                    </h3>
                    <p className="mt-1 text-stone-600">
                      Morning 6:00 AM – 1:00 PM
                      <br />
                      Evening 1:00 PM – 8:30 PM
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact form */}
            <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-lg">
              {submitted ? (
                <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold text-stone-900">
                    Message Sent
                  </h2>
                  <p className="mt-3 text-stone-600">
                    Thank you for reaching out. The temple office will get back
                    to you soon.
                  </p>
                  <p className="mt-4 text-sm text-stone-500">
                    🙏 Sri Guru Raghavendraya Namaha
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({
                        name: "",
                        email: "",
                        phone: "",
                        message: "",
                      });
                    }}
                  >
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-stone-900">
                    Send Us a Message
                  </h2>
                  <p className="mt-2 text-sm text-stone-500">
                    Fill in the form and we will respond as soon as possible.
                  </p>

                  <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    <Input
                      label="Full Name *"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Email *"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                      />
                      <Input
                        label="Phone"
                        type="tel"
                        placeholder="+91 XXXXXXXXXX"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>

                    <Textarea
                      label="Message *"
                      placeholder="How can we help you?"
                      rows={5}
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      required
                    />

                    <Button
                      type="submit"
                      loading={submitting}
                      className="w-full"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-6xl text-center text-sm text-stone-500">
            Looking to volunteer?{" "}
            <Link
              href="/volunteer"
              className="font-medium text-amber-700 hover:text-amber-800"
            >
              Join our volunteer program
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
