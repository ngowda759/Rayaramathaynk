"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { AIMessage } from "@/types/ai";
import { useAuthContext } from "@/context/AuthContext";
import { 
  saveMessage, 
  getSessionMessages,
  getUserChatSessions 
} from "@/services/chat.service";

interface AIChatContextType {
  messages: AIMessage[];
  isOpen: boolean;
  isLoading: boolean;
  sessionId: string | null;
  error: string | null;
  isLoadingHistory: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  toggleChat: () => void;
  regenerateResponse: () => Promise<void>;
  loadSessionHistory: (sessionId: string) => Promise<void>;
  userSessions: string[];
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
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<AIMessage | null>(null);
  const [userSessions, setUserSessions] = useState<string[]>([]);
  
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

  // Load user's chat sessions when user logs in
  useEffect(() => {
    async function loadUserSessions() {
      if (user?.uid) {
        try {
          const sessions = await getUserChatSessions(user.uid);
          setUserSessions(sessions.map(s => s.id));
        } catch (err) {
          console.error("Failed to load user sessions:", err);
        }
      }
    }
    loadUserSessions();
  }, [user?.uid]);

  // Save messages to Firebase
  const saveToFirebase = useCallback(async (message: AIMessage, currentSessionId: string | null) => {
    if (!currentSessionId) return;
    try {
      await saveMessage(currentSessionId, message);
    } catch (err) {
      // Silently ignore Firebase errors - message history is optional
      // Don't log to console as this is not critical functionality
    }
  }, []);

  // Load session history from Firebase
  const loadSessionHistory = useCallback(async (historySessionId: string) => {
    setIsLoadingHistory(true);
    try {
      const historyMessages = await getSessionMessages(historySessionId);
      setMessages(historyMessages);
      setSessionId(historySessionId);
      localStorage.setItem("raya_session_id", historySessionId);
    } catch (err) {
      console.error("Failed to load session history:", err);
      setError("Failed to load chat history");
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

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

    // Get current session ID
    let currentSessionId = sessionId;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          sessionId: currentSessionId,
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
      if (data.sessionId && data.sessionId !== currentSessionId) {
        currentSessionId = data.sessionId;
        setSessionId(data.sessionId);
        localStorage.setItem("raya_session_id", data.sessionId);
      }

      // Save messages to Firebase
      await saveToFirebase(userMessage, currentSessionId);
      await saveToFirebase(data.message, currentSessionId);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send message";
      
      // Check if AI is not configured - show specific message without console error
      if (errorMessage.includes("AI service is not configured")) {
        setError("Chat feature is currently unavailable");
        const aiUnavailableMessage: AIMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "🙏 Namaste! The AI assistant is temporarily unavailable. For temple inquiries, please contact the matha office directly or visit during temple hours.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiUnavailableMessage]);
        return;
      }
      
      // Log other errors for debugging
      console.error("Chat error:", err);
      setError(errorMessage);
      
      // Add generic error message
      const userFriendlyError: AIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I apologize, but I encountered an issue. Please try again or contact the temple office for assistance.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userFriendlyError]);
      await saveToFirebase(userFriendlyError, currentSessionId);
    } finally {
      setIsLoading(false);
    }
  }, [messages, sessionId, user, isLoading, saveToFirebase]);

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
      await saveToFirebase(data.message, sessionId);
    } catch (err) {
      console.error("Regenerate error:", err);
      setError(err instanceof Error ? err.message : "Failed to regenerate response");
    } finally {
      setIsLoading(false);
    }
  }, [lastUserMessage, isLoading, messages, sessionId, user, saveToFirebase]);

  const value: AIChatContextType = {
    messages,
    isOpen,
    isLoading,
    sessionId,
    error,
    isLoadingHistory,
    sendMessage,
    clearMessages,
    toggleChat,
    regenerateResponse,
    loadSessionHistory,
    userSessions,
  };

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}
