"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import SacredDivider from "@/components/home/SacredDivider";
import TestimonialSubmissionForm from "@/components/home/TestimonialSubmissionForm";
import { ArrowLeft, Star, Quote } from "lucide-react";
import Link from "next/link";

export default function TestimonialsSubmitPage() {
  const handleSuccess = () => {
    // Form handles its own success state
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-[#fff8ef]">
        
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b border-amber-100">
          <div className="mx-auto max-w-4xl px-6 py-12">
            <Breadcrumb 
              parentName="Testimonials"
              parentHref="/testimonials"
              current="Submit" 
            />
            
            <div className="text-center mt-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
                <Star size={14} className="fill-amber-500 text-amber-500" />
                SHARE YOUR STORY
              </span>
              
              <h1 className="mt-6 text-4xl md:text-5xl font-bold text-stone-900">
                Submit Your Testimonial
              </h1>
              
              <p className="mt-4 mx-auto max-w-2xl text-lg leading-8 text-stone-600">
                Your spiritual journey and experiences can inspire countless devotees. 
                Share your story with us and help others discover the divine grace of 
                Sri Raghavendra Swamy.
              </p>

              <Link
                href="/testimonials"
                className="inline-flex items-center gap-2 mt-6 text-amber-600 hover:text-amber-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                View all testimonials
              </Link>
            </div>
          </div>
        </section>

        <SacredDivider variant="lotus" />

        {/* Form Section */}
        <section className="mx-auto max-w-lg px-6 py-16">
          <div className="rounded-3xl border border-amber-200 bg-white p-8 shadow-xl">
            <TestimonialSubmissionForm 
              onSuccess={handleSuccess}
              onClose={() => window.location.href = "/testimonials"}
            />
          </div>
        </section>

        <SacredDivider variant="diya" />

      </main>
      <Footer />
    </>
  );
}
