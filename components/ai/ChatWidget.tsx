"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { FloatingButton } from "./FloatingButton";

// Lazy load the chat window for better performance
const ChatWindow = dynamic(
  () => import("./ChatWindow").then((mod) => mod.ChatWindow),
  { 
    ssr: false,
    loading: () => null
  }
);

// Check if AI chat is disabled via environment variable (default: enabled)
const isAIDisabled = process.env.NEXT_PUBLIC_AI_CHAT_ENABLED === "false";

export function ChatWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Don't render on server and skip if AI is explicitly disabled
    if (isAIDisabled) return;
    
    // Use requestAnimationFrame to defer state update
    const rafId = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Don't render on server to avoid hydration issues or if AI is disabled
  if (!mounted || isAIDisabled) {
    return null;
  }

  return (
    <>
      <FloatingButton />
      <ChatWindow />
    </>
  );
}
