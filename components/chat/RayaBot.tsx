"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function RayaBot() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  // Wait for client-side hydration
  useEffect(() => {
    try {
      // Use setTimeout to avoid synchronous state update during effect
      const timer = setTimeout(() => {
        setMounted(true);
        console.log("[Chatbase] Component mounted");
      }, 0);
      return () => clearTimeout(timer);
    } catch (e) {
      console.error("[Chatbase] Mount error:", e);
      // Use setTimeout to avoid synchronous state update during effect
      setTimeout(() => setError(String(e)), 0);
    }
  }, []);

  // Script injection effect - combines all conditions into single effect
  useEffect(() => {
    // Skip if not mounted, error, admin route, or no chatbot ID
    if (!mounted || error || pathname.startsWith("/admin") || !chatbotId || chatbotId === "your-chatbot-id") {
      return;
    }

    console.log("[Chatbase] Chatbot ID loaded:", chatbotId);

    try {
      // Check if script already exists
      const existingScript = document.querySelector(`script[src*="chatbase.co"]`);
      if (existingScript) {
        console.log("[Chatbase] Script already exists in DOM");
        return;
      }

      console.log("[Chatbase] Injecting Chatbase script...");

      // Create and inject Chatbase script
      const script = document.createElement("script");
      script.src = "https://www.chatbase.co/embed.min.js";
      script.setAttribute("data-chatbot-id", chatbotId);
      script.defer = true;
      script.async = true;
      
      script.onload = () => {
        console.log("[Chatbase] Script loaded successfully!");
      };
      
      script.onerror = () => {
        console.error("[Chatbase] Failed to load script");
      };

      document.body.appendChild(script);
      console.log("[Chatbase] Script tag added to DOM");
    } catch (e) {
      console.error("[Chatbase] Script injection error:", e);
    }
  }, [mounted, error, pathname, chatbotId]);

  return null;
}
