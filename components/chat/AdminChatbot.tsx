"use client";

import Script from "next/script";
import { useEffect } from "react";

export default function AdminChatbot() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
  const chatbaseHost = process.env.NEXT_PUBLIC_CHATBASE_HOST || "https://www.chatbase.co";
  const language = process.env.NEXT_PUBLIC_CHATBOT_LANGUAGE || "en";

  if (!chatbotId || chatbotId === "") {
    console.warn("Admin Chatbot: NEXT_PUBLIC_CHATBOT_ID is not set");
    return null;
  }

  useEffect(() => {
    // Set Chatbase configuration before the script loads
    (window as any).chatbaseConfig = {
      chatbotId: chatbotId,
      language: language,
    };
  }, [chatbotId, language]);

  return (
    <Script
      id="chatbase-admin-embed"
      src={`${chatbaseHost.replace(/\/$/, '')}/embed.min.js`}
      data-chatbot-id={chatbotId}
      strategy="lazyOnload"
      onLoad={() => {
        console.log("Admin Chatbase loaded successfully", chatbotId);
      }}
      onError={(e) => {
        console.error("Failed to load Admin Chatbase script:", e);
      }}
    />
  );
}
