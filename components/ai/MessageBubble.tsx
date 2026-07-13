"use client";

import { useState } from "react";
import { AIMessage } from "@/types/ai";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Copy, Check, RotateCcw } from "lucide-react";

interface MessageBubbleProps {
  message: AIMessage;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
}

export function MessageBubble({ message, onRegenerate, showRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      role="listitem"
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-br-md"
            : "bg-white border border-stone-200 text-stone-800 rounded-bl-md"
        }`}
      >
        <div className="text-sm">
          <MarkdownRenderer content={message.content} />
        </div>
        
        <div className={`flex items-center gap-2 mt-2 ${isUser ? "justify-end" : "justify-start"}`}>
          {!isUser && (
            <span className="text-[10px] opacity-60">
              {message.model && `via ${message.model}`}
              {message.latency && ` • ${message.latency}ms`}
            </span>
          )}
          
          {!isUser && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-stone-100 transition-colors"
                aria-label="Copy message"
                title="Copy"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-stone-400" />
                )}
              </button>
              
              {showRegenerate && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1 rounded hover:bg-stone-100 transition-colors"
                  aria-label="Regenerate response"
                  title="Regenerate"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
