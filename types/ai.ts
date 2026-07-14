// AI Chat Types

export type DetectedLanguage = "en" | "kn" | "mixed";

export interface AIMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  model?: string;
  latency?: number;
  detectedLanguage?: DetectedLanguage;
}

export interface ChatSession {
  id: string;
  userId: string | null; // Firebase UID or anonymous
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessage?: string;
  detectedLanguage?: DetectedLanguage;
}

export interface AIProvider {
  name: string;
  generateResponse(messages: AIMessage[], systemPrompt: string): Promise<string>;
  generateStreamResponse?(
    messages: AIMessage[],
    systemPrompt: string
  ): AsyncGenerator<string> | Promise<string>;
}

export interface ChatRequest {
  messages: AIMessage[];
  sessionId?: string;
  userId?: string;
  detectedLanguage?: DetectedLanguage;
}

export interface ChatResponse {
  message: AIMessage;
  sessionId: string;
  error?: string;
}

// Feedback Types
export interface ChatFeedback {
  id: string;
  sessionId: string;
  messageId: string;
  rating: "helpful" | "not_helpful" | null;
  comment?: string;
  createdAt: number;
}

// Testimonial Types
export interface Testimonial {
  id: string;
  sessionId: string;
  name: string;
  city: string;
  experience: string;
  rating: number;
  permissionToPublish: boolean;
  approved: boolean;
  createdAt: number;
}

// Volunteer Types
export interface VolunteerRequest {
  id: string;
  sessionId: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  preferredDate?: string;
  status: "pending" | "contacted" | "completed";
  createdAt: number;
}

// Suggested Questions
export interface SuggestedQuestion {
  id: string;
  text: string;
  icon?: string;
  category: string;
}

// AI Analytics
export interface AIAnalytics {
  totalConversations: number;
  totalMessages: number;
  averageResponseTime: number;
  topQuestions: Array<{ question: string; count: number }>;
  dailyConversations: Array<{ date: string; count: number }>;
  userSatisfaction: {
    helpful: number;
    notHelpful: number;
    percentage: number;
  };
}

// AI Action Types
export interface AIAction {
  type: "testimonial" | "volunteer" | "donation" | "feedback";
  data: Record<string, string | number | boolean>;
  completed: boolean;
}

// Knowledge Base Types
export interface KnowledgeItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
}
