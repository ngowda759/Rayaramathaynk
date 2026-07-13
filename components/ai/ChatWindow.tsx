"use client";

import { useEffect, useRef } from "react";
import { useAIChat } from "./AIChatProvider";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { ChatInput } from "./ChatInput";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { Trash2, Sparkles } from "lucide-react";

export function ChatWindow() {
  const { messages, isOpen, isLoading, sendMessage, clearMessages, regenerateResponse } = useAIChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSuggestedQuestion = (question: string) => {
    sendMessage(question);
  };

  const canRegenerate = messages.length > 0 && !isLoading;

  if (!isOpen) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-20 right-6 z-50 w-[calc(100vw-3rem)] sm:w-[380px] h-[600px] max-h-[70vh]
                 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden
                 border border-stone-200 animate-in slide-in-from-bottom-4 fade-in duration-300"
      role="dialog"
      aria-label="Chat with Raya AI"
      aria-modal="true"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Raya AI</h2>
            <p className="text-xs text-white/80">Sri Raghavendra Swamy Math</p>
          </div>
        </div>
        <button
          onClick={clearMessages}
          className="p-2 rounded-lg hover:bg-white/20 transition-colors"
          aria-label="Clear conversation"
          title="Clear chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-4 bg-stone-50"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <WelcomeScreen onSelectQuestion={handleSuggestedQuestion} />
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                onRegenerate={regenerateResponse}
                showRegenerate={canRegenerate && index === messages.length - 1 && message.role === "assistant"}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {messages.length > 0 && (
        <SuggestedQuestions onSelect={handleSuggestedQuestion} />
      )}

      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}

function WelcomeScreen({ onSelectQuestion }: { onSelectQuestion: (q: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-6">
        <Sparkles className="w-10 h-10 text-amber-600" />
      </div>
      
      <h3 className="text-xl font-semibold text-stone-800 mb-2">
        🙏 Namaste, Dear Devotee!
      </h3>
      
      <p className="text-sm text-stone-500 mb-6 max-w-xs">
        I am <span className="font-medium text-amber-600">Raya AI</span>, your friendly assistant from Sri Raghavendra Swamy Math.
        How may I help you today?
      </p>

      <div className="w-full space-y-3">
        <p className="text-xs text-stone-400 uppercase tracking-wide">Quick questions</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { text: "🕐 Temple Timings", q: "What are the temple timings?" },
            { text: "📅 Upcoming Events", q: "What events are coming up?" },
            { text: "🙏 Sevas Available", q: "What sevas are available?" },
            { text: "💝 How to Donate", q: "How can I donate to the temple?" },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => onSelectQuestion(item.q)}
              className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-600
                       hover:border-amber-300 hover:bg-amber-50 transition-colors text-left"
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
