"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

export default function ChatbaseWidget() {
  const [mounted, setMounted] = useState(false);
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (!chatbotId || chatbotId === "your-chatbot-id" || chatbotId === "") {
    return null;
  }

  return (
    <Script
      id="chatbase-embed"
      src="https://www.chatbase.co/embed.min.js"
      strategy="lazyOnload"
      data-chatbot-id={chatbotId}
      onLoad={() => {
        console.log("[Chatbase] Widget loaded successfully");
      }}
      onError={() => {
        console.error("[Chatbase] Failed to load widget");
      }}
    />
  );
}
