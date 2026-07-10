"use client";

import Script from "next/script";

export default function AdminChatbot() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
  const language = process.env.NEXT_PUBLIC_CHATBOT_LANGUAGE || "en";

  // Don't render if no chatbot ID is configured
  if (!chatbotId || chatbotId === "") {
    return null;
  }

  return (
    <>
      <style jsx global>{`
        .chatbase-balloon {
          left: 20px !important;
          right: auto !important;
        }
      `}</style>
      <Script id="chatbase-admin-config" strategy="beforeInteractive">
        {`
          window.chatbaseConfig = {
            chatbotId: "${chatbotId}",
            language: "${language}",
            primaryColor: "#f97316",
            buttonColor: "#f97316",
            position: "left"
          };
        `}
      </Script>

      <Script
        src="https://www.chatbase.co/embed.min.js"
        strategy="afterInteractive"
      />
    </>
  );
}
