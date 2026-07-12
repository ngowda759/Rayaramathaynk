"use client";

import Script from "next/script";

export default function AdminChatbot() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  if (!chatbotId || chatbotId === "") {
    if (process.env.NODE_ENV === "development") {
      console.warn("Admin Chatbot: NEXT_PUBLIC_CHATBOT_ID is not set. Chatbot will not be rendered.");
    }
    return null;
  }

  return (
    <Script
      id="chatbase-admin-embed"
      src="https://www.chatbase.co/embed.min.js"
      data-chatbot-id={chatbotId}
      strategy="afterInteractive"
      onLoad={() => {
        console.log("Admin Chatbase loaded successfully");
      }}
      onError={() => {
        console.error("Failed to load Admin Chatbase script");
      }}
    />
  );
}
