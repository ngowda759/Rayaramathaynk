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
      setMounted(true);
      console.log("[Chatbase] Component mounted");
    } catch (e) {
      console.error("[Chatbase] Mount error:", e);
      setError(String(e));
    }
  }, []);

  // Don't render during SSR to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  // Don't render if error occurred
  if (error) {
    console.log("[Chatbase] Skipping due to mount error:", error);
    return null;
  }

  // Exclude from admin routes
  if (pathname.startsWith("/admin")) {
    return null;
  }

  // Don't render if no chatbot ID is configured or if it's a placeholder
  if (!chatbotId || chatbotId === "your-chatbot-id") {
    console.log("[Chatbase] Chatbot ID not configured");
    return null;
  }

  console.log("[Chatbase] Chatbot ID loaded:", chatbotId);

  useEffect(() => {
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
  }, [chatbotId]);

  return null;
}
