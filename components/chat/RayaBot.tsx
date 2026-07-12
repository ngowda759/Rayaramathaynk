"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export default function RayaBot() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  if (!chatbotId || chatbotId === "") {
    if (process.env.NODE_ENV === "development") {
      console.warn("Chatbot: NEXT_PUBLIC_CHATBOT_ID is not set. Chatbot will not be rendered.");
    }
    return null;
  }

  return (
    <Script
      id="chatbase-embed"
      src="https://www.chatbase.co/embed.min.js"
      data-chatbot-id={chatbotId}
      strategy="afterInteractive"
      onLoad={() => {
        console.log("Chatbase loaded successfully");
      }}
      onError={() => {
        console.error("Failed to load Chatbase script");
      }}
    />
  );
}
