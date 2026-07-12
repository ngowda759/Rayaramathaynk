"use client";

import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Phone, Mail } from "lucide-react";
import { useState, useEffect } from "react";

interface FloatingContactProps {
  phone?: string;
  email?: string;
}

export default function FloatingContact({ 
  phone = "+91 80 2332 3456",
  email = "info@sriraghavendra.org"
}: FloatingContactProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 500);
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
        >
          {/* Contact Options */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-2"
              >
                <motion.a
                  href={`https://wa.me/${phone.replace(/\s/g, "").replace("+", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-3 rounded-full bg-green-500 px-5 py-3 text-white shadow-lg hover:bg-green-600 transition-colors"
                >
                  <MessageCircle size={22} />
                  <span className="font-medium">WhatsApp</span>
                </motion.a>
                
                <motion.a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-3 rounded-full bg-blue-500 px-5 py-3 text-white shadow-lg hover:bg-blue-600 transition-colors"
                >
                  <Phone size={22} />
                  <span className="font-medium">Call Us</span>
                </motion.a>
                
                <motion.a
                  href={`mailto:${email}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-3 rounded-full bg-purple-500 px-5 py-3 text-white shadow-lg hover:bg-purple-600 transition-colors"
                >
                  <Mail size={22} />
                  <span className="font-medium">Email</span>
                </motion.a>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Toggle Button */}
          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`relative flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition-colors ${
              isOpen ? "bg-stone-600 hover:bg-stone-700" : "bg-green-500 hover:bg-green-600"
            }`}
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X size={28} className="text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="chat"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <MessageCircle size={28} className="text-white" />
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Pulse ring animation */}
            {!isOpen && (
              <span className="absolute inset-0 rounded-full animate-ping bg-green-400 opacity-30" />
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
