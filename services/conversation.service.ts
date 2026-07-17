/**
 * Conversation Session Service
 * Manages conversation context, history, and user preferences
 */

import { db } from "@/lib/firebase";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection,
  addDoc,
  serverTimestamp,
  arrayUnion,
  Timestamp 
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

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

// Session TTL in seconds (30 minutes)
const SESSION_TTL = 30 * 60;

// Max messages to store per session
const MAX_MESSAGES = 20;

/**
 * Generate a new session ID
 */
export function generateSessionId(): string {
  return uuidv4();
}

/**
 * Get or create a session
 */
export async function getSession(sessionId: string): Promise<ConversationSession | null> {
  if (!db) return null;

  try {
    const sessionRef = doc(db, "chat_sessions", sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      return null;
    }

    const data = sessionDoc.data();
    return {
      id: sessionDoc.id,
      userId: data.userId,
      lastIntent: data.lastIntent,
      lastTopic: data.lastTopic,
      preferredLanguage: data.preferredLanguage || "en",
      messages: (data.messages || []).map((m: ConversationMessage & { timestamp?: Timestamp }) => ({
        ...m,
        timestamp: m.timestamp?.toDate?.() || new Date()
      })),
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  } catch (error) {
    console.error("[Session] Error getting session:", error);
    return null;
  }
}

/**
 * Create a new session
 */
export async function createSession(sessionId: string, userId?: string): Promise<ConversationSession> {
  if (!db) {
    return {
      id: sessionId,
      userId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const session: ConversationSession = {
    id: sessionId,
    userId,
    preferredLanguage: "en",
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const sessionRef = doc(db, "chat_sessions", sessionId);
    await setDoc(sessionRef, {
      ...session,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[Session] Error creating session:", error);
  }

  return session;
}

/**
 * Update session with new message and context
 */
export async function updateSession(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  intent: string,
  language: "en" | "kn" | "mixed"
): Promise<void> {
  if (!db) return;

  const messageId = uuidv4();
  const userMsg: ConversationMessage = {
    id: messageId + "-user",
    role: "user",
    content: userMessage,
    intent,
    timestamp: new Date(),
  };

  const assistantMsg: ConversationMessage = {
    id: messageId + "-assistant",
    role: "assistant",
    content: assistantMessage,
    intent,
    timestamp: new Date(),
  };

  try {
    const sessionRef = doc(db, "chat_sessions", sessionId);
    
    // Determine topic from intent
    const topic = mapIntentToTopic(intent);

    // Use setDoc with merge to create the document if it doesn't exist
    // This fixes the issue where updateDoc fails silently for non-existent documents
    await setDoc(sessionRef, {
      lastIntent: intent,
      lastTopic: topic,
      preferredLanguage: language,
      messages: arrayUnion(userMsg, assistantMsg),
      updatedAt: serverTimestamp(),
      // Only set these on creation
      ...(!(await getDoc(sessionRef)).exists() && {
        createdAt: serverTimestamp(),
        messageCount: 0,
      }),
    }, { merge: true });

    // Prune old messages if needed
    await pruneMessages(sessionId);
  } catch (error) {
    console.error("[Session] Error updating session:", error);
  }
}

/**
 * Prune messages to keep only the last N
 */
async function pruneMessages(sessionId: string): Promise<void> {
  if (!db) return;

  try {
    const sessionRef = doc(db, "chat_sessions", sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (!sessionDoc.exists()) return;

    const data = sessionDoc.data();
    const messages: ConversationMessage[] = data.messages || [];
    
    if (messages.length > MAX_MESSAGES) {
      // Keep only the last MAX_MESSAGES
      const prunedMessages = messages.slice(-MAX_MESSAGES);
      await updateDoc(sessionRef, { messages: prunedMessages });
    }
  } catch (error) {
    console.error("[Session] Error pruning messages:", error);
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
      "yes", "no", "okay", "ok",
      "and", "also", "more"
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
 * Clear session data
 */
export async function clearSession(sessionId: string): Promise<void> {
  if (!db) return;

  try {
    const sessionRef = doc(db, "chat_sessions", sessionId);
    await updateDoc(sessionRef, {
      messages: [],
      lastIntent: null,
      lastTopic: null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("[Session] Error clearing session:", error);
  }
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!db) return;

  try {
    const { deleteDoc } = await import("firebase/firestore");
    const sessionRef = doc(db, "chat_sessions", sessionId);
    await deleteDoc(sessionRef);
  } catch (error) {
    console.error("[Session] Error deleting session:", error);
  }
}
