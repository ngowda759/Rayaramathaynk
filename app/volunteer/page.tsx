"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitVolunteerRequest } from "@/services/chat.service";
import { Loader2, CheckCircle, AlertCircle, Users, Phone, Mail, Calendar } from "lucide-react";

const SERVICE_OPTIONS = [
  "Temple Operations & Maintenance",
  "Pooja Assistance",
  "Event Management",
  "Prasada Distribution",
  "Garden & Temple Maintenance", 
  "Ghatana Seva (Procession)",
  "Photography & Documentation",
  "Digital & Social Media",
  "Accounting & Finance",
  "Security & Crowd Management",
  "Translation (Kannada/English)",
  "Driving & Transportation",
  "Other"
];

export default function VolunteerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    service: "",
    preferredDate: "",
    experience: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await submitVolunteerRequest({
        sessionId: crypto.randomUUID(),
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        service: formData.service,
        preferredDate: formData.preferredDate || undefined
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting volunteer request:", err);
      setError("Failed to submit. Please try again or contact the temple directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800 mb-2">Thank You!</h1>
            <p className="text-stone-600 mb-6">
              Your volunteer application has been submitted successfully. Our team will contact you shortly to discuss how you can serve at the temple.
            </p>
            <p className="text-sm text-stone-500 mb-6">
              🙏 ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರ ರಾಜಯ ನಮಃ 🙏
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Become a Volunteer</h1>
          <p className="text-stone-600">
            Join our devoted volunteers in serving Lord Rama and the devotees at Sri Raghavendra Swamy Matha
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-stone-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                placeholder="Enter your full name"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-stone-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                placeholder="+91 XXXXX XXXXX"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
                <Mail className="w-4 h-4 inline mr-1" />
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                placeholder="your.email@example.com"
              />
            </div>

            {/* Service Selection */}
            <div>
              <label htmlFor="service" className="block text-sm font-medium text-stone-700 mb-1">
                Preferred Service Area <span className="text-red-500">*</span>
              </label>
              <select
                id="service"
                name="service"
                value={formData.service}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-white"
              >
                <option value="">Select a service area</option>
                {SERVICE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Preferred Date */}
            <div>
              <label htmlFor="preferredDate" className="block text-sm font-medium text-stone-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Preferred Date to Start (Optional)
              </label>
              <input
                type="date"
                id="preferredDate"
                name="preferredDate"
                value={formData.preferredDate}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              />
            </div>

            {/* Experience */}
            <div>
              <label htmlFor="experience" className="block text-sm font-medium text-stone-700 mb-1">
                Previous Volunteer Experience (Optional)
              </label>
              <textarea
                id="experience"
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none"
                placeholder="Tell us about any previous volunteer experience..."
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-stone-700 mb-1">
                Message (Optional)
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none"
                placeholder="Any additional information you'd like to share..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Submit Volunteer Application
                </>
              )}
            </button>
          </form>

          {/* Footer Note */}
          <p className="mt-6 text-center text-sm text-stone-500">
            🙏 By submitting this form, you express your willingness to serve at the temple with devotion and dedication.
          </p>
        </div>

        {/* Contact Info */}
        <div className="mt-6 text-center">
          <p className="text-stone-600 text-sm">
            For immediate assistance, please contact the temple office:
          </p>
          <p className="text-amber-700 font-medium mt-1">
            📞 +91-XXXXX-XXXXX | 📧 info@raghavendramatha.org
          </p>
        </div>
      </div>
    </div>
  );
}
