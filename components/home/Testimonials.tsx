"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
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

  const testimonials = homepage?.testimonials?.length
    ? homepage.testimonials
    : DEFAULT_TESTIMONIALS;

  const next = () => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % testimonials.length);
  };

  const prev = () => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  useEffect(() => {
    const interval = setInterval(next, 6000);
    return () => clearInterval(interval);
  }, []);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  const currentTestimonial = testimonials[current];

  return (
    <section className="bg-gradient-to-b from-[#fff8ef] via-amber-50/30 to-white py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            DEVOTEES SPEAK
          </span>

          <h2 className="mt-6 text-5xl font-bold text-stone-900">
            Words from the Heart
          </h2>

          <p className="mt-6 text-lg leading-8 text-stone-600">
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
              className="hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-white shadow-lg hover:bg-amber-50 transition-colors"
            >
              <ChevronLeft className="text-amber-700" size={24} />
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
              <div className="relative rounded-[32px] border border-amber-100 bg-white p-10 md:p-14 shadow-2xl">
                
                {/* Quote Icon */}
                <div className="absolute -top-6 left-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
                  <Quote className="text-white" size={24} />
                </div>

                {/* Testimonial Content */}
                <div className="text-center">
                  <p className="text-xl md:text-2xl leading-relaxed text-stone-700 italic">
                    "{currentTestimonial.quote}"
                  </p>

                  {/* Avatar and Info */}
                  <div className="mt-8 flex flex-col items-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-200 text-3xl">
                      🙏
                    </div>
                    
                    <h4 className="mt-4 text-xl font-bold text-stone-900">
                      {currentTestimonial.name}
                    </h4>
                    
                    <p className="mt-1 text-stone-500">
                      {currentTestimonial.location}
                    </p>
                    
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-sm font-medium text-amber-700">
                        {currentTestimonial.years}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Decorative corners */}
                <div className="absolute bottom-4 left-4 text-amber-300 text-4xl opacity-50">❋</div>
                <div className="absolute top-4 right-4 text-amber-300 text-4xl opacity-50">❋</div>
              </div>
            </motion.div>

            {/* Next Button */}
            <motion.button
              onClick={next}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-white shadow-lg hover:bg-amber-50 transition-colors"
            >
              <ChevronRight className="text-amber-700" size={24} />
            </motion.button>
          </div>

          {/* Indicators */}
          <div className="mt-10 flex items-center justify-center gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > current ? 1 : -1);
                  setCurrent(index);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === current
                    ? "w-8 bg-gradient-to-r from-amber-500 to-orange-500"
                    : "w-2 bg-amber-300 hover:bg-amber-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
