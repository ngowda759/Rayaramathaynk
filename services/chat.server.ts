import "server-only";
import { rowIdFilter } from "@/lib/supabase/identifier";

import { createAdminClient } from "@/lib/supabase/admin";
import { AIMessage, ChatSession, Testimonial, VolunteerRequest, ChatFeedback } from "@/types/ai";

/**
 * Raya AI chat sessions, messages, AI testimonials, volunteer requests and answer
 * feedback. All of it is stored in Supabase.
 *
 * `chat_sessions`, `chat_messages`, `ai_testimonials`, `ai_volunteer_requests` and
 * `ai_chat_feedback` are deny-all under RLS, so every read and write here uses the
 * service-role client. This module is server-only: the browser reaches it through the
 * `/api/ai/**` routes. There is no Firestore path.
 */

// ============= Chat Sessions =============

export async function createChatSession(userId: string | null): Promise<string> {
  const supabase = createAdminClient();
  const sessionId = crypto.randomUUID();

  const { error } = await supabase.from("chat_sessions").insert({
    firestore_id: sessionId,
    user_id: userId,
    message_count: 0,
    last_message: "",
  });

  if (error) throw new Error(`Failed to create chat session: ${error.message}`);
  return sessionId;
}

export async function updateChatSession(
  sessionId: string,
  data: Partial<ChatSession>
): Promise<void> {
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {};
  if (data.userId !== undefined) updates.user_id = data.userId;
  if (data.messageCount !== undefined) updates.message_count = data.messageCount;
  if (data.lastMessage !== undefined) updates.last_message = data.lastMessage;
  if (data.detectedLanguage !== undefined) updates.detected_language = data.detectedLanguage;

  const { error } = await supabase
    .from("chat_sessions")
    .update(updates)
    .or(rowIdFilter(sessionId));

  if (error) throw new Error(`Failed to update chat session: ${error.message}`);
}

function rowToSession(row: Record<string, unknown>): ChatSession {
  return {
    id: row.firestore_id as string,
    userId: (row.user_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
    messageCount: (row.message_count as number) ?? 0,
    lastMessage: (row.last_message as string) ?? "",
    detectedLanguage: row.detected_language as ChatSession["detectedLanguage"],
  } as ChatSession;
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .or(rowIdFilter(sessionId))
    .maybeSingle();

  if (error) throw new Error(`Failed to get chat session: ${error.message}`);
  if (!data) return null;
  return rowToSession(data);
}

export async function getUserChatSessions(
  userId: string,
  maxSessions: number = 20
): Promise<ChatSession[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(maxSessions);

  if (error) throw new Error(`Failed to get user chat sessions: ${error.message}`);
  return (data ?? []).map(rowToSession);
}

// ============= Messages =============

export async function saveMessage(sessionId: string, message: AIMessage): Promise<string> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("chat_messages").insert({
    firestore_id: message.id,
    session_id: sessionId,
    role: message.role,
    content: message.content,
    timestamp: new Date(message.timestamp).toISOString(),
    model: message.model,
    latency: message.latency,
    detected_language: message.detectedLanguage,
  });

  if (error) throw new Error(`Failed to save message: ${error.message}`);

  const session = await getChatSession(sessionId);
  if (session) {
    await updateChatSession(sessionId, {
      messageCount: session.messageCount + 1,
      lastMessage: message.content.substring(0, 100),
    });
  } else {
    // If the session row is missing (older sessions), create it.
    await supabase.from("chat_sessions").insert({
      firestore_id: sessionId,
      user_id: null,
      message_count: 1,
      last_message: message.content.substring(0, 100),
    });
  }

  return message.id;
}

export async function getSessionMessages(sessionId: string): Promise<AIMessage[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("timestamp", { ascending: true });

  if (error) throw new Error(`Failed to get session messages: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.firestore_id,
    role: row.role as "user" | "assistant" | "system",
    content: row.content,
    timestamp: new Date(row.timestamp).getTime(),
    model: row.model,
    latency: row.latency,
    detectedLanguage: row.detected_language,
  }));
}

// ============= AI Testimonials =============

const AI_TESTIMONIALS = "ai_testimonials";

function rowToAiTestimonial(row: Record<string, unknown>): Testimonial {
  return {
    id: (row.firestore_id as string) || (row.id as string),
    sessionId: (row.session_id as string) ?? "",
    name: (row.name as string) ?? "",
    city: (row.city as string) ?? "",
    experience: (row.experience as string) ?? "",
    rating: (row.rating as number) ?? 5,
    permissionToPublish: (row.permission_to_publish as boolean) ?? false,
    approved: (row.approved as boolean) ?? false,
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : 0,
  };
}

export async function submitTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt" | "approved">
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(AI_TESTIMONIALS)
    .insert({
      session_id: testimonial.sessionId ?? "",
      name: testimonial.name,
      city: testimonial.city ?? "",
      experience: testimonial.experience,
      rating: testimonial.rating,
      permission_to_publish: testimonial.permissionToPublish ?? false,
      approved: false,
    })
    .select("firestore_id, id")
    .single();
  if (error) throw new Error(`Failed to submit testimonial: ${error.message}`);
  return data.firestore_id || data.id;
}

export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(AI_TESTIMONIALS)
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Failed to read testimonials: ${error.message}`);
  return (data ?? []).map(rowToAiTestimonial);
}

export async function getPendingTestimonials(): Promise<Testimonial[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(AI_TESTIMONIALS)
    .select("*")
    .eq("approved", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to read pending testimonials: ${error.message}`);
  return (data ?? []).map(rowToAiTestimonial);
}

export async function approveTestimonial(testimonialId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(AI_TESTIMONIALS)
    .update({ approved: true })
    .or(rowIdFilter(testimonialId));
  if (error) throw new Error(`Failed to approve testimonial: ${error.message}`);
}

export async function deleteTestimonial(testimonialId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(AI_TESTIMONIALS)
    .delete()
    .or(rowIdFilter(testimonialId));
  if (error) throw new Error(`Failed to delete testimonial: ${error.message}`);
}

// ============= Volunteer Requests =============

const AI_VOLUNTEER_REQUESTS = "ai_volunteer_requests";

function rowToVolunteerRequest(row: Record<string, unknown>): VolunteerRequest {
  return {
    id: (row.firestore_id as string) || (row.id as string),
    sessionId: (row.session_id as string) ?? "",
    name: (row.name as string) ?? "",
    phone: (row.phone as string) ?? "",
    email: (row.email as string) ?? "",
    service: (row.service as string) ?? "",
    preferredDate: (row.preferred_date as string) ?? undefined,
    status: (row.status as VolunteerRequest["status"]) ?? "pending",
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : 0,
  };
}

export async function submitVolunteerRequest(
  request: Omit<VolunteerRequest, "id" | "createdAt" | "status">
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(AI_VOLUNTEER_REQUESTS)
    .insert({
      session_id: request.sessionId ?? "",
      name: request.name,
      phone: request.phone,
      email: request.email,
      service: request.service,
      preferred_date: request.preferredDate ?? null,
      status: "pending",
    })
    .select("firestore_id, id")
    .single();
  if (error) throw new Error(`Failed to submit volunteer request: ${error.message}`);
  return data.firestore_id || data.id;
}

export async function getVolunteerRequests(): Promise<VolunteerRequest[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(AI_VOLUNTEER_REQUESTS)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to read volunteer requests: ${error.message}`);
  return (data ?? []).map(rowToVolunteerRequest);
}

export async function updateVolunteerRequestStatus(
  requestId: string,
  status: "pending" | "contacted" | "completed"
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(AI_VOLUNTEER_REQUESTS)
    .update({ status })
    .or(rowIdFilter(requestId));
  if (error) throw new Error(`Failed to update volunteer request: ${error.message}`);
}

// ============= Feedback =============

const AI_CHAT_FEEDBACK = "ai_chat_feedback";

export async function submitFeedback(
  feedback: Omit<ChatFeedback, "id" | "createdAt">
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(AI_CHAT_FEEDBACK)
    .insert({
      session_id: feedback.sessionId ?? "",
      message_id: feedback.messageId ?? "",
      rating: feedback.rating,
      comment: feedback.comment ?? null,
    })
    .select("firestore_id, id")
    .single();
  if (error) throw new Error(`Failed to submit feedback: ${error.message}`);
  return data.firestore_id || data.id;
}

export async function getFeedbackStats(): Promise<{
  helpful: number;
  notHelpful: number;
  total: number;
}> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from(AI_CHAT_FEEDBACK).select("rating");
  if (error) throw new Error(`Failed to read feedback: ${error.message}`);

  let helpful = 0;
  let notHelpful = 0;
  for (const row of data ?? []) {
    if (row.rating === "helpful") helpful++;
    else if (row.rating === "not_helpful") notHelpful++;
  }
  return { helpful, notHelpful, total: helpful + notHelpful };
}
