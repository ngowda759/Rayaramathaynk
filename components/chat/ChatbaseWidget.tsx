"use client";

import { useEffect, useState } from "react";

export default function ChatbaseWidget() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
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

    // Create script element with chatbot ID as attribute
    const script = document.createElement("script");
    script.src = "https://www.chatbase.co/embed.min.js";
    script.setAttribute("data-chatbot-id", chatbotId);
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log("[Chatbase] Script loaded successfully!");
      setScriptLoaded(true);
    };
    
    script.onerror = (error) => {
      console.error("[Chatbase] Script failed to load:", error);
    };

    // Add to document
    document.head.appendChild(script);
    
    console.log("[Chatbase] Script element added with chatbot ID:", chatbotId);
  }, [chatbotId]);

  return null;
}
