"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export default function RayaBot() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
  const language = process.env.NEXT_PUBLIC_CHATBOT_LANGUAGE || "en";

  // Don't render if no chatbot ID is configured
  if (!chatbotId || chatbotId === "") {
    return null;
  }

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
        `}
      </Script>

      <Script
        src="https://www.chatbase.co/embed.min.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("Chatbase loaded");
        }}
      />
    </>
  );
}
