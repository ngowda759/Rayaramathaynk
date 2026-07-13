"use client";

import { useEffect, useState } from "react";

// Extend Window interface for chatbase
declare global {
  interface Window {
    chatbase?: (...args: unknown[]) => unknown;
    chatbase_q?: unknown[];
  }
}

export default function ChatbaseWidget() {
  const [isClient, setIsClient] = useState(false);
  const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  if (!chatbotId || chatbotId === "your-chatbot-id" || chatbotId === "") {
    return null;
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!window.chatbase || window.chatbase("getState") !== "initialized") {
        window.chatbase = function () {
          if (!window.chatbase_q) {
            window.chatbase_q = [];
          }
          window.chatbase_q!.push(arguments);
        };
        window.chatbase = new Proxy(window.chatbase, {
          get: function (_target, prop) {
            if (prop === "q") {
              return window.chatbase_q;
            }
            return function (...args: unknown[]) {
              window.chatbase!(prop as string, ...args);
            };
          },
        }) as typeof window.chatbase;
      }
      
      const onLoad = function () {
        const script = document.createElement("script");
        script.src = "https://www.chatbase.co/embed.min.js";
        script.id = chatbotId;
        document.body.appendChild(script);
      };
      
      if (document.readyState === "complete") {
        onLoad();
      } else {
        window.addEventListener("load", onLoad);
      }
    }
  }, [chatbotId]);

  return null;
}
