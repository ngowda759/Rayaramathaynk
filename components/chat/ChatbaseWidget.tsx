"use client";

import { useEffect, useState } from "react";

export default function ChatbaseWidget() {
  const [chatbotId, setChatbotId] = useState<string | undefined>(undefined);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Get chatbot ID from environment variable on client side
    const id = process.env.NEXT_PUBLIC_CHATBOT_ID;
    console.log("[Chatbase] Client-side chatbot ID:", id);
    setChatbotId(id);
  }, []);

  useEffect(() => {
    // Wait for chatbot ID to be loaded
    if (chatbotId === undefined) {
      return;
    }

    // Don't load if chatbot ID is not configured
    if (!chatbotId || chatbotId === "your-chatbot-id" || chatbotId === "") {
      console.log("[Chatbase] Chatbot ID not configured or is placeholder");
      return;
    }

    // Check if script already exists
    if (document.querySelector('script[src*="chatbase.co"]')) {
      console.log("[Chatbase] Script already loaded");
      return;
    }

    console.log("[Chatbase] Loading chatbot with ID:", chatbotId);

    // Set chatbot ID as data attribute on document body for Chatbase to find
    document.body.setAttribute("data-chatbot-id", chatbotId);

    // Create script element
    const script = document.createElement("script");
    script.src = "https://www.chatbase.co/embed.min.js";
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log("[Chatbase] Script loaded successfully!");
      setScriptLoaded(true);
    };
    
    script.onerror = (error) => {
      console.error("[Chatbase] Script failed to load:", error);
      console.error("[Chatbase] This may be due to:");
      console.error("[Chatbase] 1. Domain not allowed in Chatbase settings");
      console.error("[Chatbase] 2. Invalid chatbot ID");
      console.error("[Chatbase] 3. Network issues");
    };

    // Add to document
    document.head.appendChild(script);
    
    console.log("[Chatbase] Script element added to head");
    console.log("[Chatbase] Body data-chatbot-id attribute set");
  }, [chatbotId]);

  // Debug info in development
  useEffect(() => {
    if (chatbotId !== undefined && process.env.NODE_ENV === "development") {
      console.log("[Chatbase] Debug Info:");
      console.log("[Chatbase] - Chatbot ID:", chatbotId || "NOT SET");
      console.log("[Chatbase] - Script Loaded:", scriptLoaded);
      console.log("[Chatbase] - Current Domain:", typeof window !== "undefined" ? window.location.hostname : "unknown");
      console.log("[Chatbase] - Body chatbot ID:", document.body.getAttribute("data-chatbot-id"));
      
      if (!chatbotId || chatbotId === "your-chatbot-id" || chatbotId === "") {
        console.log("[Chatbase] ⚠️ To enable the chatbot:");
        console.log("[Chatbase] 1. Get your chatbot ID from https://www.chatbase.co");
        console.log("[Chatbase] 2. Add your domain to allowed domains in Chatbase settings");
        console.log("[Chatbase] 3. Set NEXT_PUBLIC_CHATBOT_ID in .env.local");
      }
    }
  }, [chatbotId, scriptLoaded]);

  return null;
}
