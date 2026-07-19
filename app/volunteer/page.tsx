"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Phone, Mail, MapPin, User, Briefcase, Loader2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { volunteerService } from "@/services/volunteer.service";

export default function VolunteerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    profession: "",
    address: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const volunteerId = `VOL-${Date.now().toString(36).toUpperCase()}`;
      // Include profession in address field
      const fullAddress = formData.profession 
        ? `${formData.address}\nProfession: ${formData.profession}`
        : formData.address;
        
      await volunteerService.createVolunteer({
        volunteerId,
        name: formData.name,
        phone: formData.phone,
        address: fullAddress,
        sex: "Male" as const,
        active: true,
      });
      
      setSubmitted(true);
      toast.success("Thank you for your interest in volunteering!");
    } catch (error) {
      console.error("Error submitting volunteer form:", error);
      toast.error("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 mb-4">
              🙏 Thank You for Volunteering!
            </h2>
            <p className="text-stone-600 mb-6">
              Your volunteer registration has been received. Our team will contact you shortly to discuss how you can serve at the Matha.
            </p>
            <p className="text-sm text-amber-600 font-medium mb-6">
              ಸ್ವಯಂಸೇವಕರಾಗಿ ನೋಂದಾಯಿಸಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು!
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800 mb-2">
            Become a Volunteer
          </h1>
          <p className="text-stone-600">
            Join our sevadhar program and serve the divine
          </p>
          <p className="text-amber-600 text-sm mt-1">
            ಸ್ವಯಂಸೇವಕರಾಗಿ ನೋಂದಾಯಿಸಿ
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter your full name"
                  className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="Enter your phone number"
                  className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Profession */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Profession
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  type="text"
                  name="profession"
                  value={formData.profession}
                  onChange={handleChange}
                  placeholder="e.g., Software Engineer, Teacher, Business"
                  className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-stone-400" />
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Enter your complete address"
                  className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-700 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Heart className="w-5 h-5" />
                  Register as Volunteer
                </>
              )}
            </button>
          </form>
        </div>

        {/* Contact Info */}
        <div className="mt-8 bg-amber-50 rounded-2xl p-6 text-center">
          <h3 className="font-semibold text-stone-800 mb-4">Or contact us directly</h3>
          <div className="space-y-3">
            <a href="tel:+918028446400" className="flex items-center justify-center gap-2 text-amber-700 hover:text-amber-800">
              <Phone className="w-4 h-4" />
              +91-80-28446400
            </a>
            <a href="mailto:info@raghavendramatha.org" className="flex items-center justify-center gap-2 text-amber-700 hover:text-amber-800">
              <Mail className="w-4 h-4" />
              info@raghavendramatha.org
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
