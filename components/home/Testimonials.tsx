"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { useHomepage } from "@/hooks/useHomepage";
import { Testimonial } from "@/types/homepage";

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "1",
    name: "Ramesh Rao",
    location: "Bangalore",
    quote: "The peace I feel at this Matha is indescribable. Every visit brings new spiritual strength and clarity.",
    years: "25 years devotee"
  },
  {
    id: "2",
    name: "Lakshmi Devi",
    location: "Mysore",
    quote: "Sri Raghavendra Swamy's blessings have guided my family through the most challenging times. Forever grateful.",
    years: "Family tradition"
  },
  {
    id: "3",
    name: "Venkataramana",
    location: "Chennai",
    quote: "The daily poojas and the serene atmosphere create a divine experience. This is where my soul finds rest.",
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

export default function Testimonials() {
  const { homepage } = useHomepage();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const testimonials = homepage?.testimonials?.length
    ? homepage.testimonials
    : DEFAULT_TESTIMONIALS;

  const next = useCallback(() => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % testimonials.length);
  }, [testimonials.length]);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(next, 6000);
    return () => clearInterval(interval);
  }, [isPaused, next]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  }, [prev, next]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
    }),
  };

  const currentTestimonial = testimonials[current];

  return (
    <section 
      className="bg-gradient-to-b from-[#fff8ef] via-amber-50/30 to-white py-24 overflow-hidden relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Decorative elements */}
      <div className="absolute top-10 left-10 w-32 h-32 opacity-5">
        <svg viewBox="0 0 100 100" className="text-amber-600">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </svg>
      </div>
      <div className="absolute bottom-10 right-10 w-40 h-40 opacity-5">
        <svg viewBox="0 0 100 100" className="text-amber-600">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </svg>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            <Star size={14} className="fill-amber-500 text-amber-500" />
            DEVOTEES SPEAK
          </span>

          <h2 className="mt-6 text-4xl md:text-5xl font-bold text-stone-900 tracking-tight">
            Words from the Heart
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-stone-600 max-w-2xl mx-auto">
            Experiences shared by devotees who have found peace, 
            blessings, and spiritual fulfillment at our Matha.
          </p>
        </motion.div>

        {/* Testimonial Card */}
        <div className="relative mt-16">
          <div className="flex items-center justify-center gap-4">
            
            {/* Prev Button */}
            <motion.button
              onClick={prev}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="hidden md:flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-200 bg-white shadow-lg hover:bg-amber-50 hover:border-amber-300 transition-all duration-300 group"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="text-amber-600 group-hover:text-amber-700" size={24} />
            </motion.button>

            {/* Main Card */}
            <motion.div
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="relative w-full max-w-3xl"
            >
              <div className="relative rounded-[32px] border border-amber-100/80 bg-gradient-to-br from-white to-amber-50/30 p-10 md:p-14 shadow-2xl overflow-hidden">
                
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-[0.03] sacred-pattern" />
                
                {/* Quote Icon */}
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-5 left-10 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl"
                >
                  <Quote className="text-white" size={28} />
                </motion.div>

                {/* Testimonial Content */}
                <div className="relative text-center">
                  <motion.p 
                    key={currentTestimonial.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-xl md:text-2xl leading-relaxed text-stone-700 italic"
                  >
                    &ldquo;{currentTestimonial.quote}&rdquo;
                  </motion.p>

                  {/* Avatar and Info */}
                  <motion.div 
                    key={`info-${currentTestimonial.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-10 flex flex-col items-center"
                  >
                    {/* Avatar */}
                    <div className="relative">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-orange-200 to-amber-300 text-4xl shadow-lg">
                        🙏
                      </div>
                      <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
                        <Star size={12} className="fill-current" />
                      </div>
                    </div>
                    
                    <h4 className="mt-4 text-xl font-bold text-stone-900">
                      {currentTestimonial.name}
                    </h4>
                    
                    <p className="mt-1 text-stone-500 font-medium">
                      {currentTestimonial.location}
                    </p>
                    
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-5 py-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-sm font-semibold text-amber-700">
                        {currentTestimonial.years}
                      </span>
                    </div>
                  </motion.div>
                </div>

                {/* Decorative elements */}
                <div className="absolute top-4 left-4 text-amber-300 text-3xl opacity-40">✦</div>
                <div className="absolute bottom-4 right-4 text-amber-300 text-3xl opacity-40">✦</div>
              </div>
            </motion.div>

            {/* Next Button */}
            <motion.button
              onClick={next}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="hidden md:flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-200 bg-white shadow-lg hover:bg-amber-50 hover:border-amber-300 transition-all duration-300 group"
              aria-label="Next testimonial"
            >
              <ChevronRight className="text-amber-600 group-hover:text-amber-700" size={24} />
            </motion.button>
          </div>

          {/* Indicators */}
          <div className="mt-12 flex items-center justify-center gap-3">
            {testimonials.map((_, index) => (
              <motion.button
                key={index}
                onClick={() => {
                  setDirection(index > current ? 1 : -1);
                  setCurrent(index);
                }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                className={`rounded-full transition-all duration-500 ${
                  index === current
                    ? "w-10 h-3 bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30"
                    : "w-3 h-3 bg-amber-300 hover:bg-amber-400"
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
          
          {/* Keyboard hint */}
          <p className="mt-6 text-center text-sm text-stone-400">
            Use ← → arrow keys to navigate
          </p>
        </div>
      </div>
    </section>
  );
}
