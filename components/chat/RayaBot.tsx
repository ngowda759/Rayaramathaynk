"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function RayaBot() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  // Wait for client-side hydration
  useEffect(() => {
    setMounted(true);
    console.log("[Chatbase] Component mounted");
  }, []);

  // Don't render during SSR to avoid hydration mismatch
  if (!mounted) {
    console.log("[Chatbase] Waiting for client hydration...");
    return null;
  }

  // Exclude from admin routes
  if (pathname.startsWith("/admin")) {
    console.log("[Chatbase] Skipping admin route");
    return null;
  }

  // Don't render if no chatbot ID is configured or if it's a placeholder
  if (!chatbotId || chatbotId === "your-chatbot-id") {
    console.log("[Chatbase] Chatbot ID not configured - NEXT_PUBLIC_CHATBOT_ID is not set or is placeholder");
    return null;
  }

  console.log("[Chatbase] Chatbot ID loaded:", chatbotId);
  console.log("[Chatbase] Current pathname:", pathname);

  useEffect(() => {
    // Check if script already exists
    const existingScript = document.querySelector(`script[src*="chatbase.co"]`);
    if (existingScript) {
      console.log("[Chatbase] Script already exists in DOM");
      return;
    }

    console.log("[Chatbase] Injecting Chatbase script...");

    // Set config before loading script
    (window as any).chatbaseConfig = { chatbotId };

    // Initialize chatbase queue
    (window as any).chatbase = (window as any).chatbase || function() {
      (window as any).chatbase.q = (window as any).chatbase.q || [];
      (window as any).chatbase.q.push(arguments);
    };
    (window as any).chatbase.q = (window as any).chatbase.q || [];

    // Create and inject Chatbase script
    const script = document.createElement("script");
    script.src = "https://www.chatbase.co/embed.min.js";
    script.setAttribute("data-chatbot-id", chatbotId);
    script.defer = true;
    script.async = true;
    
    script.onload = () => {
      console.log("[Chatbase] Script loaded successfully!");
    };
    
    script.onerror = (error) => {
      console.error("[Chatbase] Failed to load script:", error);
    };

    document.body.appendChild(script);
    console.log("[Chatbase] Script tag added to DOM");
  }, [chatbotId, pathname]);

  return null;
}
