"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function RayaBot() {
  const pathname = usePathname();
  
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  // Exclude from admin routes
  if (pathname.startsWith("/admin")) return null;

  // Don't render if no chatbot ID is configured or if it's a placeholder
  if (!chatbotId || chatbotId === "your-chatbot-id") {
    console.log("[Chatbase] Chatbot ID not configured - NEXT_PUBLIC_CHATBOT_ID is not set or is placeholder");
    return null;
  }

  console.log("[Chatbase] Chatbot ID loaded:", chatbotId);

  useEffect(() => {
    // Create and inject Chatbase script
    const script = document.createElement("script");
    script.src = "https://www.chatbase.co/embed.min.js";
    script.setAttribute("data-chatbot-id", chatbotId);
    script.id = chatbotId; // Some Chatbase versions use this
    script.defer = true;
    script.async = true;
    
    script.onload = () => {
      console.log("[Chatbase] Script loaded successfully");
    };
    
    script.onerror = () => {
      console.error("[Chatbase] Failed to load script");
    };

    document.body.appendChild(script);
    console.log("[Chatbase] Script tag added to DOM");

    // Initialize Chatbase
    (window as any).chatbase = (window as any).chatbase || function() {
      ((window as any).chatbase.q = (window as any).chatbase.q || []).push(arguments);
    };
    (window as any).chatbase("init", chatbotId);
    console.log("[Chatbase] Chatbase initialized");

    // Cleanup on unmount
    return () => {
      const existingScript = document.getElementById(chatbotId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [chatbotId]);

  return null; // Script injection is handled via useEffect
}
