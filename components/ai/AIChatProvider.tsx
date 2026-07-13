"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AIMessage } from "@/types/ai";
import { useAuthContext } from "@/context/AuthContext";

interface AIChatContextType {
  messages: AIMessage[];
  isOpen: boolean;
  isLoading: boolean;
  sessionId: string | null;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  toggleChat: () => void;
  regenerateResponse: () => Promise<void>;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export function useAIChat() {
  const context = useContext(AIChatContext);
  if (!context) {
    throw new Error("useAIChat must be used within AIChatProvider");
  }
  return context;
}

interface AIChatProviderProps {
  children?: ReactNode;
}

export function AIChatProvider({ children }: AIChatProviderProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<AIMessage | null>(null);
  
  const { user } = useAuthContext();

  // Lazy initialize session ID to avoid hydration issues
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("raya_session_id");
      if (stored) return stored;
      const newId = crypto.randomUUID();
      localStorage.setItem("raya_session_id", newId);
      return newId;
    }
    return null;
  });

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };

    // Add user message
    setMessages((prev) => [...prev, userMessage]);
    setLastUserMessage(userMessage);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          sessionId,
          userId: user?.uid || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();
      
      // Add assistant message
      setMessages((prev) => [...prev, data.message]);
      
      // Update session ID if new
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem("raya_session_id", data.sessionId);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
      
      // Add error message
      const errorMessage: AIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I apologize, but I encountered an issue. Please try again or contact the temple office for assistance.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, sessionId, user, isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    // Generate new session ID
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    localStorage.setItem("raya_session_id", newSessionId);
  }, []);

  const regenerateResponse = useCallback(async () => {
    if (!lastUserMessage || isLoading) return;

    // Remove the last assistant message if exists
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const lastMsg = prev[prev.length - 1];
      if (lastMsg.role === "assistant") {
        return prev.slice(0, -1);
      }
      return prev;
    });

    // Re-send the last user message
    const messagesWithoutLastAssistant = messages.filter((_, i) => 
      i !== messages.length - 1 || messages[i].role !== "assistant"
    );
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messagesWithoutLastAssistant,
          sessionId,
          userId: user?.uid || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      console.error("Regenerate error:", err);
      setError(err instanceof Error ? err.message : "Failed to regenerate response");
    } finally {
      setIsLoading(false);
    }
  }, [lastUserMessage, isLoading, messages, sessionId, user]);

  const value: AIChatContextType = {
    messages,
    isOpen,
    isLoading,
    sessionId,
    error,
    sendMessage,
    clearMessages,
    toggleChat,
    regenerateResponse,
  };

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}
