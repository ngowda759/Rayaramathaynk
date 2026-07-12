"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ChatbaseWidget() {
  const pathname = usePathname();
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  useEffect(() => {
    // Don't load on admin pages
    if (pathname?.startsWith("/admin")) return;
    
    // Don't load if chatbot ID is not configured
    if (!chatbotId || chatbotId === "your-chatbot-id") return;

    // Check if script already exists
    if (document.querySelector('script[src*="chatbase.co"]')) return;

    const script = document.createElement("script");
    script.src = "https://www.chatbase.co/embed.min.js";
    script.setAttribute("data-chatbot-id", chatbotId);
    script.defer = true;
    script.async = true;
    script.crossOrigin = "anonymous";
    
    document.body.appendChild(script);
  }, [pathname, chatbotId]);

  return null;
}
