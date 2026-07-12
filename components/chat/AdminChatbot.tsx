"use client";

export default function AdminChatbot() {
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
  const chatbaseHost = process.env.NEXT_PUBLIC_CHATBASE_HOST || "https://www.chatbase.co";

  if (!chatbotId || chatbotId === "") {
    return null;
  }

  // Fix double slash in URL and remove trailing slash
  const cleanHost = chatbaseHost.replace(/\/\//g, "//").replace(/\/$/, "");
  const embedUrl = `${cleanHost}/embed.min.js`;

  return (
    <script
      src={embedUrl}
      data-chatbot-id={chatbotId}
      defer
    />
  );
}
