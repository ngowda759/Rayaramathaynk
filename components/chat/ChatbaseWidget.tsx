"use client";

import Script from "next/script";
import { useState } from "react";

export default function ChatbaseWidget() {
  const [mounted, setMounted] = useState(false);
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  if (!mounted) {
    // Only render on client
    if (typeof window !== "undefined") {
      setMounted(true);
    }
    return null;
  }

  if (!chatbotId || chatbotId === "your-chatbot-id" || chatbotId === "") {
    return null;
  }

  return (
    <>
      <Script
        id="chatbase-widget"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.chatbaseConfig = {
              chatbotId: "${chatbotId}"
            };
          `
        }}
      />
      <Script
        id="chatbase-embed"
        src="https://www.chatbase.co/embed.min.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log("[Chatbase] Widget loaded successfully");
        }}
        onError={() => {
          console.error("[Chatbase] Failed to load widget");
        }}
      />
    </>
  );
}
