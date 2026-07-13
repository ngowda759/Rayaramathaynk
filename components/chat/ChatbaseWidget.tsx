"use client";

import { useEffect, useState } from "react";

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
      (function () {
        if (!window.chatbase || window.chatbase("getState") !== "initialized") {
          window.chatbase = function () {
            if (!window.chatbase.q) {
              window.chatbase.q = [];
            }
            window.chatbase.q.push(arguments);
          };
          window.chatbase = new Proxy(window.chatbase, {
            get: function (target, prop) {
              if (prop === "q") {
                return target.q;
              }
              return function () {
                target(prop, ...arguments);
              };
            },
          });
        }
        var onLoad = function () {
          var script = document.createElement("script");
          script.src = "https://www.chatbase.co/embed.min.js";
          script.id = chatbotId;
          script.domain = "www.chatbase.co";
          document.body.appendChild(script);
        };
        if (document.readyState === "complete") {
          onLoad();
        } else {
          window.addEventListener("load", onLoad);
        }
      })();
    }
  }, []);

  return null;
}
