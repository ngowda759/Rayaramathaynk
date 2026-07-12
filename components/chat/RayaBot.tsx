"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

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

  // Chatbase script URL
  const embedUrl = "https://www.chatbase.co/embed.min.js";

  const handleScriptLoad = () => {
    console.log("[Chatbase] Script loaded successfully");
  };

  const handleScriptError = () => {
    console.error("[Chatbase] Failed to load script");
  };

  return (
    <>
      {/* Chatbase embed script with chatbot ID in data attribute */}
      <Script
        id="chatbase-embed"
        src={embedUrl}
        data-chatbot-id={chatbotId}
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
        onError={handleScriptError}
      />
      {/* Initialize Chatbase with the chatbot ID */}
      <Script id="chatbase-init" strategy="afterInteractive">
        {`
          window.chatbase = window.chatbase || function() {
            (window.chatbase.q = window.chatbase.q || []).push(arguments);
          };
          window.chatbase("init", "${chatbotId}");
          console.log("[Chatbase] Chatbase initialized");
        `}
      </Script>
    </>
  );
}
