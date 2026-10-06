import { AIMessage, ChatSession, Testimonial, VolunteerRequest, ChatFeedback } from "@/types/ai";
import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

// ============= Chat Sessions =============

export async function createChatSession(userId: string | null): Promise<string> {
  const supabase = createClient();
  const sessionId = crypto.randomUUID();

  const { error } = await supabase.from('chat_sessions').insert({
    firestore_id: sessionId,
    user_id: userId,
    message_count: 0,
    last_message: "",
  });

  if (error) {
    throw new Error(`Failed to create chat session: ${error.message}`);
  }

  return sessionId;
}

export async function updateChatSession(
  sessionId: string,
  data: Partial<ChatSession>
): Promise<void> {
  const supabase = createClient();

  const updates: any = {};
  if (data.userId !== undefined) updates.user_id = data.userId;
  if (data.messageCount !== undefined) updates.message_count = data.messageCount;
  if (data.lastMessage !== undefined) updates.last_message = data.lastMessage;
  if (data.detectedLanguage !== undefined) updates.detected_language = data.detectedLanguage;

  const { error } = await supabase
    .from('chat_sessions')
    .update(updates)
    .eq('firestore_id', sessionId);

  if (error) {
    throw new Error(`Failed to update chat session: ${error.message}`);
  }
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('firestore_id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get chat session: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.firestore_id,
    userId: data.user_id,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
    messageCount: data.message_count,
    lastMessage: data.last_message,
    detectedLanguage: data.detected_language,
  } as ChatSession;
}

export async function getUserChatSessions(
  userId: string,
  maxSessions: number = 20
): Promise<ChatSession[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(maxSessions);

  if (error) {
    throw new Error(`Failed to get user chat sessions: ${error.message}`);
  }

  return (data || []).map(row => ({
    id: row.firestore_id,
    userId: row.user_id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    messageCount: row.message_count,
    lastMessage: row.last_message,
    detectedLanguage: row.detected_language,
  } as ChatSession));
}

// ============= Messages =============

export async function saveMessage(
  sessionId: string,
  message: AIMessage
): Promise<string> {
  const supabase = createClient();

  const { error } = await supabase.from('chat_messages').insert({
    firestore_id: message.id,
    session_id: sessionId,
    role: message.role,
    content: message.content,
    timestamp: new Date(message.timestamp).toISOString(),
    model: message.model,
    latency: message.latency,
    detected_language: message.detectedLanguage,
  });

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`);
  }
  
  // Update session message count and last message
  const session = await getChatSession(sessionId);
  if (session) {
    await updateChatSession(sessionId, {
      messageCount: session.messageCount + 1,
      lastMessage: message.content.substring(0, 100),
    });
  } else {
      // If session doesn't exist, create it. This can happen for older sessions.
      await supabase.from('chat_sessions').insert({
        firestore_id: sessionId,
        user_id: null,
        message_count: 1,
        last_message: message.content.substring(0, 100),
      });
  }

  return message.id;
}

export async function getSessionMessages(sessionId: string): Promise<AIMessage[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to get session messages: ${error.message}`);
  }

  return (data || []).map(row => ({
    id: row.firestore_id,
    role: row.role as "user" | "assistant" | "system",
    content: row.content,
    timestamp: new Date(row.timestamp).getTime(),
    model: row.model,
    latency: row.latency,
    detectedLanguage: row.detected_language,
  }));
}

// TODO: The following functions (Testimonials, Volunteer Requests, Feedback)
// still use Firebase because they are not part of BOT-003. They will be migrated in future tasks.
// To avoid breaking the app during development, they are kept here as-is using Firebase.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const TESTIMONIALS_COLLECTION = "testimonials";
const VOLUNTEER_REQUESTS_COLLECTION = "volunteer_requests";
const FEEDBACK_COLLECTION = "feedback";

// ============= Testimonials =============

export async function submitTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt" | "approved">
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const testimonialData = {
    ...testimonial,
    approved: false,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, TESTIMONIALS_COLLECTION), testimonialData);
  return docRef.id;
}

export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  if (!db) throw new Error("Firebase not configured");

  const q = query(
    collection(db, TESTIMONIALS_COLLECTION),
    where("approved", "==", true),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toMillis?.() || doc.data().createdAt,
  })) as Testimonial[];
}

export async function getPendingTestimonials(): Promise<Testimonial[]> {
  if (!db) throw new Error("Firebase not configured");

  const q = query(
    collection(db, TESTIMONIALS_COLLECTION),
    where("approved", "==", false),
    orderBy("createdAt", "desc")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toMillis?.() || doc.data().createdAt,
  })) as Testimonial[];
}

export async function approveTestimonial(testimonialId: string): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  await updateDoc(doc(db, TESTIMONIALS_COLLECTION, testimonialId), {
    approved: true,
  });
}

export async function deleteTestimonial(testimonialId: string): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  await deleteDoc(doc(db, TESTIMONIALS_COLLECTION, testimonialId));
}

// ============= Volunteer Requests =============

export async function submitVolunteerRequest(
  request: Omit<VolunteerRequest, "id" | "createdAt" | "status">
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const requestData = {
    ...request,
    status: "pending",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, VOLUNTEER_REQUESTS_COLLECTION), requestData);
  return docRef.id;
}

export async function getVolunteerRequests(): Promise<VolunteerRequest[]> {
  if (!db) throw new Error("Firebase not configured");

  const q = query(
    collection(db, VOLUNTEER_REQUESTS_COLLECTION),
    orderBy("createdAt", "desc")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toMillis?.() || doc.data().createdAt,
  })) as VolunteerRequest[];
}

export async function updateVolunteerRequestStatus(
  requestId: string,
  status: "pending" | "contacted" | "completed"
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  await updateDoc(doc(db, VOLUNTEER_REQUESTS_COLLECTION, requestId), {
    status,
  });
}

// ============= Feedback =============

export async function submitFeedback(
  feedback: Omit<ChatFeedback, "id" | "createdAt">
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const feedbackData = {
    ...feedback,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, FEEDBACK_COLLECTION), feedbackData);
  return docRef.id;
}

export async function getFeedbackStats(): Promise<{
  helpful: number;
  notHelpful: number;
  total: number;
}> {
  if (!db) throw new Error("Firebase not configured");

  const querySnapshot = await getDocs(collection(db, FEEDBACK_COLLECTION));
  
  let helpful = 0;
  let notHelpful = 0;

  querySnapshot.docs.forEach((doc) => {
    const rating = doc.data().rating;
    if (rating === "helpful") helpful++;
    else if (rating === "not_helpful") notHelpful++;
  });

  return {
    helpful,
    notHelpful,
    total: helpful + notHelpful,
  };
}
