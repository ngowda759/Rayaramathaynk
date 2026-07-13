"use client";

import { useEffect, useRef, useState } from "react";
import { useAIChat } from "./AIChatProvider";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { ChatInput } from "./ChatInput";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { Trash2, Sparkles, History, X, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function ChatWindow() {
  const { 
    messages, 
    isOpen, 
    isLoading, 
    sendMessage, 
    clearMessages, 
    regenerateResponse,
    loadSessionHistory,
    userSessions,
    sessionId,
    welcomeMessage 
  } = useAIChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
      className={`fixed z-50 left-6 bottom-20
                 w-[calc(100vw-3rem)] sm:w-[420px] lg:w-[480px]
                 transition-all duration-300 ease-in-out
                 ${isExpanded ? 'h-[75vh] max-h-[75vh]' : 'h-[600px] max-h-[70vh]'}
                 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden
                 border border-stone-200 animate-in slide-in-from-bottom-4 fade-in duration-300`}
      role="dialog"
      aria-label="Chat with Raya AI"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Raya AI</h2>
            <p className="text-xs text-white/80">Sri Raghavendra Swamy Math</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            aria-label={isExpanded ? "Minimize chat" : "Maximize chat"}
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {userSessions.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              aria-label="Toggle chat history"
              title="Chat history"
            >
              <History className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={clearMessages}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Clear conversation"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Session History Sidebar */}
      {showHistory && userSessions.length > 0 && (
        <div className="border-b border-stone-200 bg-stone-50 p-3 max-h-40 overflow-y-auto flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-stone-500">Previous Chats</p>
            <button 
              onClick={() => setShowHistory(false)}
              className="p-1 hover:bg-stone-200 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1">
            {userSessions.map((sid) => (
              <button
                key={sid}
                onClick={() => {
                  loadSessionHistory(sid);
                  setShowHistory(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between
                          ${sid === sessionId ? 'bg-amber-100 text-amber-800' : 'hover:bg-stone-100 text-stone-600'}`}
              >
                <span className="truncate">{sid.slice(0, 8)}...</span>
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-stone-50 to-stone-100"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <WelcomeScreen onSelectQuestion={handleSuggestedQuestion} welcomeMessage={welcomeMessage} />
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

      {/* Suggested Questions - Only show when there are messages */}
      {messages.length > 0 && (
        <SuggestedQuestions onSelect={handleSuggestedQuestion} />
      )}

      {/* Input Area */}
      <div className="flex-shrink-0">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}

function WelcomeScreen({ onSelectQuestion, welcomeMessage }: { 
  onSelectQuestion: (q: string) => void;
  welcomeMessage: string 
}) {
  // Default welcome message if not loaded
  const defaultWelcome = `🙏 Namaste, Dear Devotee!

I am **Raya AI**, your friendly assistant from Sri Raghavendra Swamy Math.

How may I assist you today?`;

  const displayMessage = welcomeMessage || defaultWelcome;

  const quickQuestions = [
    { text: "🕐 Temple Timings", q: "What are the temple timings?" },
    { text: "📅 Upcoming Events", q: "What events are coming up?" },
    { text: "🙏 Sevas Available", q: "What sevas are available?" },
    { text: "💝 How to Donate", q: "How can I donate to the temple?" },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      {/* Avatar */}
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-4 shadow-lg">
        <Sparkles className="w-8 h-8 text-amber-600" />
      </div>
      
      {/* Welcome Message */}
      <div className="text-sm text-stone-600 mb-6 max-w-sm prose prose-sm prose-stone">
        <ReactMarkdown>{displayMessage}</ReactMarkdown>
      </div>

      {/* Quick Questions - Horizontal Pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {quickQuestions.map((item, i) => (
          <button
            key={i}
            onClick={() => onSelectQuestion(item.q)}
            className="px-4 py-2 bg-white border border-stone-200 rounded-full text-xs text-stone-600
                     hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 
                     transition-all duration-200 shadow-sm"
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}
