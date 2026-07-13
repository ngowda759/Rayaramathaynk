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

export function ChatWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use requestAnimationFrame to defer state update
    const rafId = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Don't render on server to avoid hydration issues
  if (!mounted) {
    return null;
  }

  return (
    <>
      <FloatingButton />
      <ChatWindow />
    </>
  );
}
