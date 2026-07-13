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

// Check if AI chat is enabled via environment variable
const isAIEnabled = process.env.NEXT_PUBLIC_AI_CHAT_ENABLED === "true";

export function ChatWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Don't render on server and only show if AI chat is enabled
    if (!isAIEnabled) return;
    
    // Use requestAnimationFrame to defer state update
    const rafId = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Don't render on server to avoid hydration issues or if AI is not enabled
  if (!mounted || !isAIEnabled) {
    return null;
  }

  return (
    <>
      <FloatingButton />
      <ChatWindow />
    </>
  );
}
