"use client";

import { motion } from "framer-motion";

interface SacredDividerProps {
  variant?: "mandala" | "lotus" | "om" | "diya";
  className?: string;
}

export default function SacredDivider({ 
  variant = "mandala", 
  className = "" 
}: SacredDividerProps) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative"
      >
        {/* Left decorative line */}
        <div className="absolute right-full top-1/2 w-24 h-px bg-gradient-to-r from-transparent via-amber-400 to-amber-600" />
        
        {/* Center mandala/pattern */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Outer ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-amber-300"
          />
          
          {/* Inner ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
            className="absolute inset-2 rounded-full border border-amber-400/50"
          />
          
          {/* Center symbol based on variant */}
          <div className="relative z-10 flex items-center justify-center">
            {variant === "mandala" && (
              <svg viewBox="0 0 100 100" className="w-12 h-12 text-amber-600">
                <motion.path
                  d="M50 10 L55 25 L70 25 L58 35 L63 50 L50 40 L37 50 L42 35 L30 25 L45 25 Z"
                  fill="currentColor"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                <circle cx="50" cy="50" r="8" fill="currentColor" opacity="0.6" />
              </svg>
            )}
            
            {variant === "lotus" && (
              <svg viewBox="0 0 100 100" className="w-12 h-12 text-amber-600">
                <motion.path
                  d="M50 80 Q30 60 50 40 Q70 60 50 80"
                  fill="currentColor"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.path
                  d="M50 70 Q25 55 35 35 Q50 50 50 70"
                  fill="currentColor"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.2 }}
                />
                <motion.path
                  d="M50 70 Q75 55 65 35 Q50 50 50 70"
                  fill="currentColor"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
                />
                <circle cx="50" cy="50" r="6" fill="currentColor" opacity="0.8" />
              </svg>
            )}
            
            {variant === "om" && (
              <span className="text-3xl text-amber-600 font-serif">ॐ</span>
            )}
            
            {variant === "diya" && (
              <motion.div
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-4 h-6 bg-gradient-to-b from-amber-400 to-orange-500 rounded-b-full"
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-3 bg-orange-300 rounded-full blur-[2px]" />
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Right decorative line */}
        <div className="absolute left-full top-1/2 w-24 h-px bg-gradient-to-l from-transparent via-amber-400 to-amber-600" />
      </motion.div>
    </div>
  );
}
