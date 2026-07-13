"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      onSend(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = message.trim().length > 0 && !isLoading && !disabled;

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-stone-200 bg-white">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            disabled={isLoading || disabled}
            rows={1}
            className="w-full px-4 py-2.5 pr-12 rounded-xl border border-stone-200 
                     focus:border-amber-400 focus:ring-2 focus:ring-amber-100
                     resize-none text-sm placeholder-stone-400
                     disabled:bg-stone-100 disabled:cursor-not-allowed
                     transition-all duration-200"
            aria-label="Message input"
          />
        </div>
        
        <button
          type="submit"
          disabled={!canSend}
          className={`
            flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
            transition-all duration-200
            ${canSend 
              ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-md hover:shadow-lg" 
              : "bg-stone-200 text-stone-400 cursor-not-allowed"
            }
            focus:outline-none focus:ring-2 focus:ring-amber-300
          `}
          aria-label="Send message"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
      
      <p className="text-[10px] text-stone-400 mt-2 text-center">
        Raya AI may make mistakes. Verify important information with temple office.
      </p>
    </form>
  );
}
