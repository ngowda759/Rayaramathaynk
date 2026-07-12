"use client";

import { useEffect } from "react";

export default function ChatbaseWidget() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  useEffect(() => {
    // Don't load if chatbot ID is not configured
    if (!chatbotId || chatbotId === "your-chatbot-id") {
      console.log("[Chatbase] Chatbot ID not configured");
      return;
    }

    console.log("[Chatbase] Loading chatbot with ID:", chatbotId);

    // Check if script already exists
    if (document.querySelector('script[src*="chatbase.co"]')) {
      console.log("[Chatbase] Script already loaded");
      return;
    }

    // Create script element
    const script = document.createElement("script");
    script.src = "https://www.chatbase.co/embed.min.js";
    script.setAttribute("data-chatbot-id", chatbotId);
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log("[Chatbase] Script loaded successfully!");
    };
    
    script.onerror = (error) => {
      console.error("[Chatbase] Script failed to load:", error);
    };

    // Add to document
    document.head.appendChild(script);
    
    console.log("[Chatbase] Script element added to head");
  }, [chatbotId]);

  return null;
}
