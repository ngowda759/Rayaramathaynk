// Chat Service for Firebase integration
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AIMessage, ChatSession, Testimonial, VolunteerRequest, ChatFeedback } from "@/types/ai";

// Collection names
const CHAT_SESSIONS_COLLECTION = "chat_sessions";
const MESSAGES_COLLECTION = "messages";
const TESTIMONIALS_COLLECTION = "testimonials";
const VOLUNTEER_REQUESTS_COLLECTION = "volunteer_requests";
const FEEDBACK_COLLECTION = "feedback";

// ============= Chat Sessions =============

export async function createChatSession(userId: string | null): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const sessionData = {
    userId: userId || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    messageCount: 0,
    lastMessage: "",
  };

  const docRef = await addDoc(collection(db, CHAT_SESSIONS_COLLECTION), sessionData);
  return docRef.id;
}

export async function updateChatSession(
  sessionId: string,
  data: Partial<ChatSession>
): Promise<void> {
  if (!db) throw new Error("Firebase not configured");

  await updateDoc(doc(db, CHAT_SESSIONS_COLLECTION, sessionId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  if (!db) throw new Error("Firebase not configured");

  const docSnap = await getDoc(doc(db, CHAT_SESSIONS_COLLECTION, sessionId));
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as ChatSession;
  }
  return null;
}

export async function getUserChatSessions(
  userId: string,
  maxSessions: number = 20
): Promise<ChatSession[]> {
  if (!db) throw new Error("Firebase not configured");

  const q = query(
    collection(db, CHAT_SESSIONS_COLLECTION),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc"),
    limit(maxSessions)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChatSession));
}

// ============= Messages =============

export async function saveMessage(
  sessionId: string,
  message: AIMessage
): Promise<string> {
  if (!db) throw new Error("Firebase not configured");

  const messageData = {
    sessionId,
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    model: message.model || null,
    latency: message.latency || null,
  };

  const docRef = await addDoc(collection(db, MESSAGES_COLLECTION), messageData);
  
  // Update session message count and last message
  const session = await getChatSession(sessionId);
  if (session) {
    await updateChatSession(sessionId, {
      messageCount: session.messageCount + 1,
      lastMessage: message.content.substring(0, 100),
    });
  }

  return docRef.id;
}

export async function getSessionMessages(sessionId: string): Promise<AIMessage[]> {
  if (!db) throw new Error("Firebase not configured");

  const q = query(
    collection(db, MESSAGES_COLLECTION),
    where("sessionId", "==", sessionId),
    orderBy("timestamp", "asc")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.id,
      role: data.role,
      content: data.content,
      timestamp: data.timestamp?.toMillis?.() || data.timestamp,
      model: data.model,
      latency: data.latency,
    } as AIMessage;
  });
}

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
