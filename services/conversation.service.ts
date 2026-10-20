/**
 * Conversation Session Service
 * Manages conversation context, history, and user preferences.
 *
 * Supabase-only: sessions live in `chat_sessions` and their messages in
 * `chat_messages` (see `supabase/migrations/20260930000000_create_ai_tables.sql`).
 * There is no Firestore fallback. Per-message persistence is owned by the client
 * (`services/chat.service.ts#saveMessage`); this service maintains the session
 * summary row and reads history back for follow-up detection.
 */

import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

// Types
export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  timestamp: Date;
}

export interface ConversationSession {
  id: string;
  userId?: string;
  lastIntent?: string;
  lastTopic?: string;
  preferredLanguage?: "en" | "kn" | "mixed";
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Session TTL for the in-memory conversational state (30 minutes).
const SESSION_TTL = 30 * 60 * 1000;

/**
 * Conversational state (`lastIntent` / `lastTopic`) has no column in the
 * Supabase session schema (`AI_FIELD_SPECS.chat_sessions.intentionallyExcluded`).
 * It is process-local and best-effort: a cold start simply loses follow-up
 * context for a session, which is a graceful degradation, not data loss.
 */
const conversationalState = new Map<
  string,
  { lastIntent: string; lastTopic: string; updatedAt: number }
>();

function getSupabase() {
  return typeof window === "undefined" ? createAdminClient() : createClient();
}

function toLanguage(value: unknown): "en" | "kn" | "mixed" {
  return value === "kn" || value === "mixed" ? value : "en";
}

function readState(sessionId: string): { lastIntent?: string; lastTopic?: string } {
  const state = conversationalState.get(sessionId);
  if (!state) return {};
  if (Date.now() - state.updatedAt > SESSION_TTL) {
    conversationalState.delete(sessionId);
    return {};
  }
  return { lastIntent: state.lastIntent, lastTopic: state.lastTopic };
}

/**
 * Generate a new session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Get a session and its history from Supabase.
 *
 * Returns `null` when the session row does not exist. A read failure is logged
 * and also returns `null`; the chat path treats a missing session as a new one.
 */
export async function getSession(sessionId: string): Promise<ConversationSession | null> {
  if (!sessionId) return null;

  try {
    const supabase = getSupabase();

    const { data: sessionRow, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("firestore_id", sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error("[Session] Error reading chat_sessions:", sessionError.message);
      return null;
    }
    if (!sessionRow) return null;

    const { data: messageRows, error: messagesError } = await supabase
      .from("chat_messages")
      .select("firestore_id, role, content, timestamp")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: true });

    if (messagesError) {
      console.error("[Session] Error reading chat_messages:", messagesError.message);
      return null;
    }

    const { lastIntent, lastTopic } = readState(sessionId);

    const messages: ConversationMessage[] = (messageRows || []).map((row) => ({
      id: (row.firestore_id as string) || crypto.randomUUID(),
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content as string,
      timestamp: row.timestamp ? new Date(row.timestamp as string) : new Date(),
    }));

    return {
      id: sessionId,
      userId: (sessionRow.user_id as string) ?? undefined,
      lastIntent,
      lastTopic,
      // `preferredLanguage` is stored in `chat_sessions.detected_language`.
      preferredLanguage: sessionRow.detected_language
        ? toLanguage(sessionRow.detected_language)
        : "en",
      messages,
      createdAt: sessionRow.created_at ? new Date(sessionRow.created_at as string) : new Date(),
      updatedAt: sessionRow.updated_at ? new Date(sessionRow.updated_at as string) : new Date(),
    };
  } catch (error) {
    console.error("[Session] Error getting session:", error);
    return null;
  }
}

/**
 * Create a new session row in Supabase.
 */
export async function createSession(sessionId: string, userId?: string): Promise<ConversationSession> {
  const now = new Date();

  const session: ConversationSession = {
    id: sessionId,
    userId,
    preferredLanguage: "en",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("chat_sessions").upsert(
      {
        firestore_id: sessionId,
        user_id: userId ?? null,
        detected_language: "en",
        last_message: "",
      },
      { onConflict: "firestore_id" }
    );

    if (error) {
      console.error("[Session] Error creating session:", error.message);
    }
  } catch (error) {
    console.error("[Session] Error creating session:", error);
  }

  return session;
}

/**
 * Update a session with the latest turn.
 *
 * Only the session summary row is written: `message_count` and the individual
 * messages are owned by `services/chat.service.ts#saveMessage` (the client
 * persists both turns after this endpoint returns), so writing them here would
 * double-count. `message_count` is deliberately omitted from the upsert payload
 * so a conflict-update preserves the existing count.
 */
export async function updateSession(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  intent: string,
  language: "en" | "kn" | "mixed"
): Promise<void> {
  if (!sessionId) return;

  void userMessage;

  const topic = mapIntentToTopic(intent);
  conversationalState.set(sessionId, {
    lastIntent: intent,
    lastTopic: topic,
    updatedAt: Date.now(),
  });

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("chat_sessions").upsert(
      {
        firestore_id: sessionId,
        detected_language: language,
        last_message: assistantMessage.substring(0, 100),
      },
      { onConflict: "firestore_id" }
    );

    if (error) {
      console.error("[Session] Error updating session:", error.message);
    }
  } catch (error) {
    console.error("[Session] Error updating session:", error);
  }
}

/**
 * Map intent to a general topic for context
 */
function mapIntentToTopic(intent: string): string {
  const topicMap: Record<string, string> = {
    TEMPLE_TIMINGS: "timings",
    CONTACT_INFORMATION: "contact",
    LOCATION: "location",
    UPCOMING_EVENTS: "events",
    NEXT_AARADHANE: "aaradhane",
    DAILY_QUOTE: "quote",
    SPECIAL_SEVAS: "sevas",
    DONATION: "donation",
    PANCHANGA: "panchanga",
    VISITOR_GUIDELINES: "guidelines",
    TEMPLE_HISTORY: "history",
    SRI_RAGHAVENDRA: "guru",
    VOLUNTEER: "volunteer",
    SHARE_EXPERIENCE: "testimonial",
  };

  return topicMap[intent] || "general";
}

/**
 * Detect follow-up question and enrich context
 */
export function detectFollowUp(
  currentMessage: string,
  lastTopic?: string
): { isFollowUp: boolean; enrichedContext?: string } {
  if (!lastTopic) {
    return { isFollowUp: false };
  }

  const lowerMessage = currentMessage.toLowerCase();

  // Follow-up patterns
  const followUpPatterns = [
    // Time-related follow-ups
    { pattern: /^(morning|evening|afternoon|evening|time|timing)$/i, topic: "timings" },
    { pattern: /^(morning|evening|afternoon)$/i, topic: "timings" },
    { pattern: /^(evening|morning) (timings?|time)$/i, topic: "timings" },

    // Contact follow-ups
    { pattern: /^(phone|email|address|contact)$/i, topic: "contact" },

    // Donation follow-ups
    { pattern: /^(how|where|where|where|which).*donate/i, topic: "donation" },
    { pattern: /^(donate|donation|payment|80g|80 g)$/i, topic: "donation" },

    // Seva follow-ups
    { pattern: /^(seva|pooja|archana|booking)$/i, topic: "sevas" },

    // Event follow-ups
    { pattern: /^(event|festival|aaradhane)$/i, topic: "events" },

    // Quote follow-ups
    { pattern: /^(another|one more|next|different|other)$/i, topic: "quote" },
    { pattern: /^(give me )?(another|one more|another)$/i, topic: "quote" },
    { pattern: /^(ಮತ್ತೊಂದು|ಇನ್ನೊಂದು|ಬೇರೆ)/i, topic: "quote" },

    // General follow-ups
    { pattern: /^(more|another|also|and|also)$/i, topic: lastTopic },
    { pattern: /^(tell me more|what about|and|also|too)$/i, topic: lastTopic },
  ];

  for (const { pattern, topic } of followUpPatterns) {
    if (pattern.test(lowerMessage)) {
      return {
        isFollowUp: true,
        enrichedContext: `Previous topic was about ${topic}. ${currentMessage}`,
      };
    }
  }

  // Check if message is just a short query (likely follow-up)
  const words = lowerMessage.split(/\s+/);
  if (words.length <= 3 && lastTopic) {
    // Common single-word follow-ups
    const singleWordFollowUps = [
      "timings", "timing", "time", "morning", "evening",
      "contact", "phone", "email",
      "seva", "pooja", "sevas",
      "event", "events", "aaradhane",
      "donation", "donate", "80g",
      "quote", "quotes", "verse", "sloka",
      "yes", "no", "okay", "ok",
      "and", "also", "more", "another"
    ];

    if (singleWordFollowUps.includes(lowerMessage)) {
      return {
        isFollowUp: true,
        enrichedContext: `Previous topic was about ${lastTopic}. ${currentMessage}`,
      };
    }
  }

  return { isFollowUp: false };
}

/**
 * Get session context for better responses
 */
export async function getSessionContext(sessionId: string): Promise<{
  session: ConversationSession | null;
  isFollowUp: boolean;
  enrichedMessage?: string;
}> {
  if (!sessionId) {
    return { session: null, isFollowUp: false };
  }

  const session = await getSession(sessionId);

  if (!session) {
    return { session: null, isFollowUp: false };
  }

  // Check if this is a follow-up based on last message
  const lastMessage = session.messages[session.messages.length - 1];
  if (lastMessage && lastMessage.role === "assistant") {
    const followUp = detectFollowUp(lastMessage.content, session.lastTopic);
    return {
      session,
      isFollowUp: followUp.isFollowUp,
      enrichedMessage: followUp.enrichedContext,
    };
  }

  return { session, isFollowUp: false };
}

/**
 * Clear a session's message history.
 */
export async function clearSession(sessionId: string): Promise<void> {
  if (!sessionId) return;

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("session_id", sessionId);

    if (error) {
      console.error("[Session] Error clearing session messages:", error.message);
    }

    await supabase
      .from("chat_sessions")
      .update({ last_message: "", detected_language: null })
      .eq("firestore_id", sessionId);

    conversationalState.delete(sessionId);
  } catch (error) {
    console.error("[Session] Error clearing session:", error);
  }
}

/**
 * Delete a session and its messages.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) return;

  try {
    const supabase = getSupabase();
    await supabase.from("chat_messages").delete().eq("session_id", sessionId);
    await supabase.from("chat_sessions").delete().eq("firestore_id", sessionId);
    conversationalState.delete(sessionId);
  } catch (error) {
    console.error("[Session] Error deleting session:", error);
  }
}
