"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import "@/types/chatbot";

export default function RayaBot() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
  const chatbaseHost = process.env.NEXT_PUBLIC_CHATBASE_HOST || "https://www.chatbase.co";
  const language = process.env.NEXT_PUBLIC_CHATBOT_LANGUAGE || "en";

  if (!chatbotId || chatbotId === "") {
    if (process.env.NODE_ENV === "development") {
      console.warn("Chatbot: NEXT_PUBLIC_CHATBOT_ID is not set. Chatbot will not be rendered.");
    }
    return null;
  }

  // Fix double slash in URL
  const cleanHost = chatbaseHost.endsWith("/") ? chatbaseHost.slice(0, -1) : chatbaseHost;
  const embedUrl = `${cleanHost}/embed.min.js`;

  return (
    <>
      <Script id="chatbase-config" strategy="beforeInteractive">
        {`
          window.chatbaseConfig = {
            chatbotId: "${chatbotId}",
            language: "${language}",
            primaryColor: "#f97316",
            buttonColor: "#f97316"
          };
          window.chatbaseConfig && console.log("Chatbase config set:", window.chatbaseConfig);
        `}
      </Script>

      <Script
        src={embedUrl}
        data-chatbot-id={chatbotId}
        strategy="afterInteractive"
        onLoad={() => {
          console.log("Chatbase script loaded successfully");
        }}
        onError={() => {
          console.error("Failed to load Chatbase script");
        }}
      />
    </>
  );
}
