"use client";

import Script from "next/script";

export default function AdminChatbot() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
  const language = process.env.NEXT_PUBLIC_CHATBOT_LANGUAGE || "en";

  if (!chatbotId) return null;

  return (
    <>
      <Script id="chatbase-admin-config" strategy="beforeInteractive">
        {`
          window.chatbaseConfig = {
            chatbotId: "${chatbotId}",
            language: "${language}"
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
