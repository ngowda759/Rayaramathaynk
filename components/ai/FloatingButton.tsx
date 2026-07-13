"use client";

import { useAIChat } from "./AIChatProvider";
import { MessageCircle, X } from "lucide-react";

export function FloatingButton() {
  const { isOpen, toggleChat } = useAIChat();

  return (
    <button
      onClick={toggleChat}
      className={`
        fixed bottom-6 left-6 z-50
        w-14 h-14 rounded-full
        flex items-center justify-center
        shadow-lg transition-all duration-300
        focus:outline-none focus:ring-4 focus:ring-amber-200
        ${isOpen 
          ? "bg-stone-700 hover:bg-stone-800 rotate-0" 
          : "bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
        }
      `}
      aria-label={isOpen ? "Close chat" : "Open chat"}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-white" />
      ) : (
        <MessageCircle className="w-6 h-6 text-white" />
      )}
    </button>
  );
}
