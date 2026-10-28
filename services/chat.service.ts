import { apiFetch } from "@/lib/api/fetch";
import { AIMessage, ChatSession, Testimonial, VolunteerRequest, ChatFeedback } from "@/types/ai";

/**
 * Raya AI chat sessions, messages, AI testimonials, volunteer requests and answer
 * feedback. Everything is stored in Supabase behind deny-all RLS, so the browser never
 * reads the tables directly: this module calls the same-origin `/api/ai/chat/**` and
 * `/api/testimonials` / `/api/volunteer` routes, which use the service role server-side.
 * There is no Firestore path.
 */

export async function createChatSession(userId: string | null): Promise<string> {
  const { id } = await apiFetch<{ id: string }>("/api/ai/chat/session", {
    method: "POST",
    body: { userId },
  });
  return id;
}

export async function updateChatSession(
  sessionId: string,
  data: Partial<ChatSession>
): Promise<void> {
  await apiFetch(`/api/ai/chat/session/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: data,
  });
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  try {
    return await apiFetch<ChatSession>(`/api/ai/chat/session/${encodeURIComponent(sessionId)}`);
  } catch {
    return null;
  }
}

export async function getUserChatSessions(
  userId: string,
  maxSessions: number = 20
): Promise<ChatSession[]> {
  return apiFetch<ChatSession[]>(
    `/api/ai/chat/sessions?user=${encodeURIComponent(userId)}&limit=${maxSessions}`
  );
}

export async function saveMessage(sessionId: string, message: AIMessage): Promise<string> {
  const { id } = await apiFetch<{ id: string }>("/api/ai/chat/messages", {
    method: "POST",
    body: { sessionId, message },
  });
  return id;
}

export async function getSessionMessages(sessionId: string): Promise<AIMessage[]> {
  return apiFetch<AIMessage[]>(`/api/ai/chat/messages?session=${encodeURIComponent(sessionId)}`);
}

export async function submitFeedback(
  feedback: Omit<ChatFeedback, "id" | "createdAt">
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>("/api/ai/chat/feedback", {
    method: "POST",
    body: feedback,
  });
  return id;
}

// ============= Testimonials =============

export async function submitTestimonial(
  testimonial: Omit<Testimonial, "id" | "createdAt" | "approved">
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>("/api/testimonials", {
    method: "POST",
    body: testimonial,
  });
  return id;
}

export async function getApprovedTestimonials(): Promise<Testimonial[]> {
  const { testimonials } = await apiFetch<{ testimonials: Testimonial[] }>(
    "/api/testimonials",
    { auth: false }
  );
  return testimonials;
}

export async function getPendingTestimonials(): Promise<Testimonial[]> {
  return apiFetch<Testimonial[]>("/api/ai/chat/testimonials?pending=1");
}

export async function approveTestimonial(testimonialId: string): Promise<void> {
  await apiFetch(`/api/ai/chat/testimonials/${encodeURIComponent(testimonialId)}`, {
    method: "PATCH",
    body: { approved: true },
  });
}

export async function deleteTestimonial(testimonialId: string): Promise<void> {
  await apiFetch(`/api/ai/chat/testimonials/${encodeURIComponent(testimonialId)}`, {
    method: "DELETE",
  });
}

// ============= Volunteer Requests =============

export async function submitVolunteerRequest(
  request: Omit<VolunteerRequest, "id" | "createdAt" | "status">
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>("/api/volunteer", {
    method: "POST",
    body: request,
  });
  return id;
}

export async function getVolunteerRequests(): Promise<VolunteerRequest[]> {
  const { requests } = await apiFetch<{ requests: VolunteerRequest[] }>(
    "/api/volunteer",
    { auth: false }
  );
  return requests;
}

export async function updateVolunteerRequestStatus(
  requestId: string,
  status: "pending" | "contacted" | "completed"
): Promise<void> {
  await apiFetch(`/api/ai/chat/volunteer-requests/${encodeURIComponent(requestId)}`, {
    method: "PATCH",
    body: { status },
  });
}
