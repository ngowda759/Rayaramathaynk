"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

export default function RayaBot() {
  const pathname = usePathname();
  
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  // Exclude from admin routes
  if (pathname.startsWith("/admin")) return null;

  // Don't render if no chatbot ID is configured
  if (!chatbotId) {
    console.log("[Chatbase] Chatbot ID not configured - NEXT_PUBLIC_CHATBOT_ID is not set");
    return null;
  }

  console.log("[Chatbase] Chatbot ID loaded:", chatbotId);

  // Chatbase script URL - using the standard embed script
  const chatbaseHost = process.env.NEXT_PUBLIC_CHATBASE_HOST || "https://www.chatbase.co";
  const embedUrl = `${chatbaseHost.replace(/\/$/, "")}/embed.min.js`;

  const handleScriptLoad = () => {
    console.log("[Chatbase] Script loaded successfully");
  };

  const handleScriptError = () => {
    console.error("[Chatbase] Failed to load script from:", embedUrl);
  };

  return (
    <>
      <Script
        id="chatbase-widget"
        src={embedUrl}
        data-chatbot-id={chatbotId}
        strategy="afterInteractive"
        onLoad={handleScriptLoad}
        onError={handleScriptError}
      />
      {/* Fallback initialization for older Chatbase implementations */}
      <Script id="chatbase-init" strategy="afterInteractive">
        {`
          // Initialize Chatbase once the script has loaded
          window.chatbaseConfig = {
            chatbotId: "${chatbotId}"
          };
          
          // Queue commands until Chatbase is ready
          window.chatbase = window.chatbase || function() {
            (window.chatbase.q = window.chatbase.q || []).push(arguments);
          };
          
          // Signal that Chatbase has been initialized
          window.chatbase("init", "${chatbotId}");
          
          console.log("[Chatbase] Chatbase initialized with ID: ${chatbotId}");
        `}
      </Script>
    </>
  );
}
