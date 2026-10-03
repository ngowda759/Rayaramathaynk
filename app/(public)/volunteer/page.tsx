"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import { Heart, Users, Phone, Mail, CheckCircle2, Sparkles } from "lucide-react";

const volunteerServices = [
  { name: "Pooja Assistance", description: "Help with daily rituals and special pujas" },
  { name: "Annadanam Service", description: "Assist with the free meals program" },
  { name: "Crowd Management", description: "Help manage devotees during festivals" },
  { name: "Temple Maintenance", description: "Keep the temple premises clean and beautiful" },
  { name: "Event Coordination", description: "Assist with temple events and programs" },
];

export default function VolunteerPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    service: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone || !formData.service) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/volunteer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit");
      }

      setSubmitted(true);
      toast.success("Thank you for your interest in volunteering!");
    } catch (error) {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-orange-700 via-amber-600 to-orange-800 py-12">
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
            <Breadcrumb current="Volunteer" />
            <div className="mt-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white md:text-5xl">
                Become a Volunteer
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-orange-100">
                Join our volunteer (sevadhar) program and serve the divine. 
                Your service is a sacred offering.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-orange-100">
                  <Phone className="h-4 w-4" />
                  <span>+91-80-28446400</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-orange-100">
                  <Mail className="h-4 w-4" />
                  <span>info@raghavendramatha.org</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Volunteer Services */}
        <section className="px-6 py-12 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-stone-900">
              Volunteer Opportunities
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {volunteerServices.map((service) => (
                <div
                  key={service.name}
                  className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6"
                >
                  <Heart className="mb-3 h-6 w-6 text-orange-600" />
                  <h3 className="font-semibold text-stone-900">{service.name}</h3>
                  <p className="mt-1 text-sm text-stone-600">{service.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Registration Form */}
        <section className="px-6 py-12 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-2xl">
            {submitted ? (
              <div className="rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-8 text-center shadow-lg">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-800">
                  Registration Submitted!
                </h2>
                <p className="mt-3 text-stone-600">
                  Thank you for your interest in volunteering. Our team will contact you 
                  at the phone number or email you provided.
                </p>
                <p className="mt-4 text-sm text-stone-500">
                  🙏 Sri Guru Raghavendraya Namaha
                </p>
                <Button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: "", email: "", phone: "", service: "", message: "" });
                  }}
                  className="mt-6"
                  variant="outline"
                >
                  Submit Another Request
                </Button>
              </div>
            ) : (
              <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-lg">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                    <Sparkles className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-stone-900">
                      Register as a Volunteer
                    </h2>
                    <p className="text-sm text-stone-500">
                      Fill out the form below and we will contact you
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <Input
                    label="Full Name *"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Email *"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />

                    <Input
                      label="Phone Number *"
                      type="tel"
                      placeholder="+91 XXXXXXXXXX"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-stone-700">
                      Preferred Service Area *
                    </label>
                    <select
                      value={formData.service}
                      onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                      required
                      className="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    >
                      <option value="">Select a service area</option>
                      {volunteerServices.map((service) => (
                        <option key={service.name} value={service.name}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Textarea
                    label="Message (Optional)"
                    placeholder="Tell us about your interests or any questions..."
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />

                  <Button
                    type="submit"
                    loading={submitting}
                    className="w-full"
                  >
                    Submit Volunteer Request
                  </Button>

                  <p className="text-center text-sm text-stone-500">
                    Training is provided for all volunteers. Your service (seva) is considered a sacred offering.
                  </p>
                </form>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
