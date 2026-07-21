// Conversation Memory - Session context for follow-up questions
// Enables multi-turn conversations with context awareness

import { Intent } from "./intent/types";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  intent?: Intent;
  timestamp: number;
}

export interface SessionContext {
  sessionId: string;
  messages: ConversationMessage[];
  lastIntent?: Intent;
  lastTopic?: string;
  entities?: Record<string, string>;
  createdAt: number;
  lastActivity: number;
}

const MAX_MESSAGES = 10;
const CONTEXT_EXPIRY = 30 * 60 * 1000; // 30 minutes

// In-memory session store (use Redis/DB in production)
const sessions = new Map<string, SessionContext>();

/**
 * Get or create a session
 */
export function getSession(sessionId: string): SessionContext {
  const now = Date.now();
  let session = sessions.get(sessionId);

  if (session) {
    // Check if session expired
    if (now - session.lastActivity > CONTEXT_EXPIRY) {
      sessions.delete(sessionId);
      session = undefined;
    }
  }

  if (!session) {
    session = {
      sessionId,
      messages: [],
      createdAt: now,
      lastActivity: now,
    };
    sessions.set(sessionId, session);
  }

  return session;
}

/**
 * Add a message to the conversation history
 */
export function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  intent?: Intent
): SessionContext {
  const session = getSession(sessionId);

  session.messages.push({
    role,
    content,
    intent,
    timestamp: Date.now(),
  });

  // Keep only last MAX_MESSAGES
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }

  // Update context
  if (intent) {
    session.lastIntent = intent;
    session.lastTopic = extractTopic(content, intent);
  }

  session.lastActivity = Date.now();

  return session;
}

/**
 * Extract topic/entity from message
 */
function extractTopic(content: string, intent: Intent): string {
  const lower = content.toLowerCase();

  switch (intent) {
    case Intent.TEMPLE_TIMINGS:
      if (lower.includes("morning")) return "morning timings";
      if (lower.includes("evening")) return "evening timings";
      return "temple timings";
    case Intent.SPECIAL_SEVAS:
    case Intent.DAILY_POOJA:
      return "sevas";
    case Intent.DONATION:
      return "donation";
    case Intent.PANCHANGA:
      return "panchanga";
    case Intent.UPCOMING_EVENTS:
      return "events";
    case Intent.DAILY_QUOTE:
      return "quote";
    default:
      return "general";
  }
}

/**
 * Resolve follow-up questions using session context
 */
export function resolveFollowUp(
  currentMessage: string,
  session: SessionContext
): { resolved: string; context: string } | null {
  if (!session.lastIntent || session.messages.length < 2) {
    return null;
  }

  const lower = currentMessage.toLowerCase();
  const lastMessage = session.messages[session.messages.length - 2]?.content || "";

  // Check for follow-up patterns
  const followUpPatterns = [
    // Short responses that need context
    { pattern: /^(morning|evening)$/i, topic: "timing" },
    { pattern: /^how much$/i, topic: "price" },
    { pattern: /^free$/i, topic: "free" },
    { pattern: /^when$/i, topic: "time" },
    { pattern: /^where$/i, topic: "location" },
    { pattern: /^how$/i, topic: "how" },
    { pattern: /^yes$/i, topic: "confirm" },
    { pattern: /^no$/i, topic: "deny" },
    { pattern: /^and$/i, topic: "more" },
    // Quote follow-ups
    { pattern: /^(another|one more|next|different)$/i, topic: "quote" },
    { pattern: /^quote$/i, topic: "quote" },
    { pattern: /^(ಮತ್ತೊಂದು|ಇನ್ನೊಂದು)$/i, topic: "quote" }, // Kannada another
    { pattern: /^ಮತ್ತೊಂದು ಉಲ್ಲೇಖ$/i, topic: "quote" }, // another quote in Kannada
    { pattern: /^ಉಲ್ಲೇಖ$/i, topic: "quote" }, // quote in Kannada
    { pattern: /^ಶ್ಲೋಕ$/i, topic: "quote" }, // sloka in Kannada
    { pattern: /^ವಚನ$/i, topic: "quote" }, // vachana in Kannada
    { pattern: /^ಹೌದಾ|ಅಲ್ಲ$/i, topic: "confirm_deny" }, // Kannada yes/no
    { pattern: /^ಬೆಳಗ್|ಸಂಜೆ$/i, topic: "timing" }, // morning/evening
  ];

  for (const { pattern, topic } of followUpPatterns) {
    if (pattern.test(currentMessage.trim())) {
      const context = buildContext(session, topic);
      if (context) {
        return {
          resolved: `${currentMessage} ${context}`,
          context: session.lastTopic || "previous topic",
        };
      }
    }
  }

  return null;
}

/**
 * Build context string for follow-up
 */
function buildContext(session: SessionContext, topic: string): string {
  const intent = session.lastIntent;
  if (!intent) return "";

  switch (topic) {
    case "timing":
      if (intent === Intent.TEMPLE_TIMINGS) {
        return "temple timing"; // Context: they asked about temple timings
      }
      break;
    case "price":
      if (intent === Intent.DONATION || intent === Intent.SPECIAL_SEVAS) {
        return "price"; // Context: they asked about donation/seva price
      }
      break;
    case "time":
      if (intent === Intent.TEMPLE_TIMINGS) {
        return "open"; // "when" -> "when does it open"
      }
      break;
    case "quote":
      if (intent === Intent.DAILY_QUOTE) {
        return "quote"; // Context: they asked for a devotional quote
      }
      break;
  }

  return "";
}

/**
 * Get conversation summary
 */
export function getConversationSummary(sessionId: string): {
  messageCount: number;
  lastIntent?: Intent;
  lastTopic?: string;
  duration: number;
} {
  const session = getSession(sessionId);
  return {
    messageCount: session.messages.length,
    lastIntent: session.lastIntent,
    lastTopic: session.lastTopic,
    duration: Date.now() - session.createdAt,
  };
}

/**
 * Clear session
 */
export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Get all active sessions (for analytics)
 */
export function getActiveSessions(): SessionContext[] {
  const now = Date.now();
  const active: SessionContext[] = [];

  sessions.forEach((session) => {
    if (now - session.lastActivity < CONTEXT_EXPIRY) {
      active.push(session);
    }
  });

  return active;
}
