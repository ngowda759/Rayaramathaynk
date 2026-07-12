"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function GoUpButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 md:bottom-10 md:right-10 group"
          aria-label="Go to top"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-amber-500 blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
          
          {/* Button */}
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 shadow-xl transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/30 active:scale-95">
            <ArrowUp className="h-6 w-6 text-white" />
          </div>
          
          {/* Pulse ring on hover */}
          <div className="absolute inset-0 rounded-full border-2 border-amber-400 opacity-0 group-hover:animate-ping group-hover:opacity-50" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
