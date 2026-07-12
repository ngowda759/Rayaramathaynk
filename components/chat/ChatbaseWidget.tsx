"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

export default function ChatbaseWidget() {
  const [mounted, setMounted] = useState(false);
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render on server
  if (!mounted) return null;

  // Don't load if chatbot ID is not configured
  if (!chatbotId || chatbotId === "your-chatbot-id") {
    console.log("[Chatbase] Chatbot ID not configured");
    return null;
  }

  console.log("[Chatbase] Loading chatbot with ID:", chatbotId);

  return (
    <Script
      src="https://www.chatbase.co/embed.min.js"
      data-chatbot-id={chatbotId}
      strategy="lazyOnload"
      onLoad={() => {
        console.log("[Chatbase] Script loaded successfully");
      }}
      onError={(e) => {
        console.error("[Chatbase] Script failed to load:", e);
      }}
    />
  );
}
