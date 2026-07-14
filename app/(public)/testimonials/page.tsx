"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import SacredDivider from "@/components/home/SacredDivider";
import { getApprovedTestimonials } from "@/services/testimonial.service";
import { Testimonial } from "@/types/homepage";
import { Star, Quote, MapPin, Calendar, ImageIcon } from "lucide-react";
import Image from "next/image";

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    name: "Ramesh Rao",
    location: "Bangalore",
    quote: "The peace I feel at this Matha is indescribable. Every visit brings new spiritual strength and clarity. The daily poojas and the serene atmosphere create a divine experience.",
    years: "25 years devotee"
  },
  {
    id: "2",
    name: "Lakshmi Devi",
    location: "Mysore",
    quote: "Sri Raghavendra Swamy's blessings have guided my family through the most challenging times. Forever grateful for the divine guidance received here.",
    years: "Family tradition"
  },
  {
    id: "3",
    name: "Venkataramana",
    location: "Chennai",
    quote: "The daily poojas and the serene atmosphere create a divine experience. This is where my soul finds rest and peace.",
    years: "15 years devotee"
  },
  {
    id: "4",
    name: "Shobha Krishnan",
    location: "Hyderabad",
    quote: "Attending the Bramhotsavam was life-changing. The devotion and rituals are performed with such purity and dedication.",
    years: "Regular visitor"
  },
];

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestimonial, setSelectedTestimonial] = useState<Testimonial | null>(null);

  useEffect(() => {
    async function loadTestimonials() {
      try {
        const data = await getApprovedTestimonials();
        setTestimonials(data.length > 0 ? data : DEFAULT_TESTIMONIALS);
      } catch {
        setTestimonials(DEFAULT_TESTIMONIALS);
      } finally {
        setLoading(false);
      }
    }
    loadTestimonials();
  }, []);

  const testimonialsToShow = testimonials.length > 0 ? testimonials : DEFAULT_TESTIMONIALS;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-[#fff8ef]">
        
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-b border-amber-100">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <Breadcrumb current="Testimonials" />
            
            <div className="text-center mt-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
                <Star size={14} className="fill-amber-500 text-amber-500" />
                DEVOTEES SPEAK
              </span>
              
              <h1 className="mt-6 text-4xl md:text-5xl font-bold text-stone-900">
                Words from the Heart
              </h1>
              
              <p className="mt-6 mx-auto max-w-3xl text-lg leading-8 text-stone-600">
                Experiences shared by devotees who have found peace, blessings, 
                and spiritual fulfillment at Sri Raghavendra Swamy Matha.
              </p>
            </div>
          </div>
        </section>

        <SacredDivider variant="lotus" />

        {/* Testimonials Grid */}
        <section className="mx-auto max-w-7xl px-6 py-16">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
            </div>
          ) : (
            <>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {testimonialsToShow.map((testimonial) => (
                  <div
                    key={testimonial.id}
                    onClick={() => setSelectedTestimonial(testimonial)}
                    className="group cursor-pointer rounded-3xl border border-amber-100 bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-amber-200"
                  >
                    {/* Quote Icon */}
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg mb-6">
                      <Quote size={24} />
                    </div>

                    {/* Image */}
                    {testimonial.image ? (
                      <div className="relative mb-6">
                        <div className="relative h-20 w-20 mx-auto rounded-full overflow-hidden border-4 border-amber-100 shadow-lg">
                          <Image
                            src={testimonial.image}
                            alt={testimonial.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center mb-6">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-orange-200 to-amber-300 text-4xl shadow-lg">
                          🙏
                        </div>
                      </div>
                    )}

                    {/* Quote */}
                    <p className="text-stone-600 leading-relaxed line-clamp-4 italic">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>

                    {/* Author Info */}
                    <div className="mt-6 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-stone-900">
                          {testimonial.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-stone-500">
                          <MapPin size={14} />
                          {testimonial.location}
                        </div>
                      </div>
                    </div>

                    {/* Badge */}
                    <div className="mt-4 flex items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-4 py-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-sm font-semibold text-amber-700">
                          {testimonial.years}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {testimonialsToShow.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 text-amber-600 mb-6">
                    <Quote size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-stone-900">
                    No Testimonials Yet
                  </h3>
                  <p className="mt-4 text-stone-600 max-w-md mx-auto">
                    We would love to hear about your experience at our Matha. 
                    Share your story with us!
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* Share Your Experience CTA */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 p-12 text-center shadow-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white mb-6">
              <Quote size={28} />
            </div>
            <h2 className="text-3xl font-bold text-stone-900">
              Share Your Experience
            </h2>
            <p className="mt-4 text-lg text-stone-600 max-w-2xl mx-auto">
              Have you visited our Matha? Share your spiritual journey and 
              help other devotees discover the divine experience at 
              Sri Raghavendra Swamy Matha.
            </p>
            <div className="mt-8 flex items-center justify-center gap-2 text-amber-600">
              <Calendar size={20} />
              <span className="text-sm">Contact the temple office to share your testimonial</span>
            </div>
          </div>
        </section>

        <SacredDivider variant="diya" />

      </main>
      <Footer />

      {/* Modal for detailed view */}
      {selectedTestimonial && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedTestimonial(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 md:p-12">
              {/* Close Button */}
              <button
                onClick={() => setSelectedTestimonial(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors"
              >
                ✕
              </button>

              {/* Quote Icon */}
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xl mb-8">
                <Quote size={28} />
              </div>

              {/* Image */}
              {selectedTestimonial.image ? (
                <div className="relative mb-8">
                  <div className="relative h-32 w-32 mx-auto rounded-full overflow-hidden border-4 border-amber-200 shadow-xl">
                    <Image
                      src={selectedTestimonial.image}
                      alt={selectedTestimonial.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center mb-8">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-orange-200 to-amber-300 text-6xl shadow-xl">
                    🙏
                  </div>
                </div>
              )}

              {/* Quote */}
              <blockquote className="text-xl md:text-2xl leading-relaxed text-stone-700 italic text-center mb-8">
                &ldquo;{selectedTestimonial.quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="text-center">
                <h3 className="text-2xl font-bold text-stone-900">
                  {selectedTestimonial.name}
                </h3>
                <div className="flex items-center justify-center gap-2 mt-2 text-stone-500">
                  <MapPin size={16} />
                  {selectedTestimonial.location}
                </div>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-6 py-3">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-semibold text-amber-700">
                    {selectedTestimonial.years}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
