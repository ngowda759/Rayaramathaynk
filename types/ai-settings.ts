// AI Settings Types
// Defines the structure for AI Management Center settings

export type AISettingsLanguage = "en" | "kn" | "mixed";

export type AISettingsStatus = "draft" | "review" | "published";

export type PromptVersionStatus = "draft" | "review" | "published" | "archived";

export type IntentStatus = "enabled" | "disabled";

export type UnknownQuestionStatus = "pending" | "in_review" | "resolved" | "added_to_knowledge";

export type UnknownQuestionAssignedTo = "unassigned" | string; // User ID

// ==================== TEMPLE INFORMATION ====================

export interface TempleTimings {
  morningOpen: string;
  morningClose: string;
  eveningOpen: string;
  eveningClose: string;
  specialNotes?: string;
}

export interface TempleContact {
  phone: string;
  email: string;
  address: string;
  googleMapsUrl?: string;
}

export interface TempleOfficeHours {
  weekday: string;
  weekend: string;
  notes?: string;
}

export interface TempleInformation {
  timings: TempleTimings;
  contact: TempleContact;
  officeHours: TempleOfficeHours;
}

// ==================== VISITOR INFORMATION ====================

// Simplified types for Admin UI - storing content as strings

export interface VisitorInformation {
  guidelines: string;
  dressCode: string;
  photographyPolicy: string;
  parking: string;
  facilities: string;
  wheelchairAccess: string;
  drinkingWater: string;
  restrooms: string;
  prasada: string;
  annadanam: string;
  accommodation: string;
  volunteerInfo: string;
  testimonials: string;
  contact: string;
}

// ==================== TEMPLE POLICIES ====================

// Simplified types for Admin UI
export interface TemplePolicies {
  donations: string;
  information80G: string;
  sevaBooking: string;
  onlineServices: string;
  childrenPolicy: string;
  queueGuidelines: string;
}

// ==================== AI RESPONSES ====================

// Simplified types for Admin UI
export interface AIResponses {
  greeting: string;
  welcome: string;
  fallback: string;
  unknownQuestion: string;
  outOfScope: string;
  goodbye: string;
}

// ==================== AI BEHAVIOR SETTINGS ====================

export interface AIBehaviorSettings {
  confidenceThreshold: number;
  semanticThreshold: number;
  maxRelatedArticles: number;
  conversationTimeout: number;
  streaming: boolean;
  debugMode: boolean;
  unknownLogging: boolean;
}

// ==================== PROMPT MANAGEMENT ====================

export interface PromptVersion {
  id: string;
  name: string;
  version: number;
  content: string;
  status: PromptVersionStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  reviewedBy?: string;
  publishedAt?: Date;
  publishedBy?: string;
  rollbackOf?: string;
  changeNotes?: string;
}

export interface PromptSettings {
  currentPromptId: string;
  versions: PromptVersion[];
  defaultPrompt: string;
}

// ==================== INTENT MANAGEMENT ====================

export interface IntentKeyword {
  keyword: string;
  language: "en" | "kn";
  isActive: boolean;
}

export interface IntentExample {
  text: string;
  language: "en" | "kn";
}

export interface IntentMetadata {
  id: string;
  intentId?: string; // for compatibility
  name: string;
  description: string;
  status: IntentStatus;
  keywords: IntentKeyword[];
  examples: IntentExample[];
  confidence: number;
  successRate?: number;
  knowledgeSource?: string;
  route?: string;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

export interface IntentSettings {
  intents: IntentMetadata[];
}

// ==================== UNKNOWN QUESTIONS ====================

export interface UnknownQuestion {
  id: string;
  question: string;
  questionLower?: string;
  intent?: string;
  detectedIntent?: string;
  confidence: number;
  language?: AISettingsLanguage;
  timestamp: Date;
  sessionId?: string;
  timesAsked: number;
  status: UnknownQuestionStatus;
  assignedTo?: string;
  lastAsked?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  response?: string;
  addedToKnowledgeArticleId?: string;
  notes?: string;
}

// ==================== DEFAULT VALUES ====================

export const DEFAULT_TEMPLE_TIMINGS: TempleTimings = {
  morningOpen: "6:00 AM",
  morningClose: "12:30 PM",
  eveningOpen: "5:00 PM",
  eveningClose: "8:30 PM",
};

export const DEFAULT_TEMPLE_CONTACT: TempleContact = {
  phone: "+91-80-28446400",
  email: "info@raghavendramatha.org",
  address: "Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru - 560064, Karnataka, India",
  googleMapsUrl: "https://maps.google.com/?q=Sri+Raghavendra+Swamy+Matha+Yelahanka",
};

export const DEFAULT_TEMPLE_OFFICE_HOURS: TempleOfficeHours = {
  weekday: "9:00 AM - 5:00 PM",
  weekend: "10:00 AM - 4:00 PM",
};

export const DEFAULT_TEMPLE_INFORMATION: TempleInformation = {
  timings: DEFAULT_TEMPLE_TIMINGS,
  contact: DEFAULT_TEMPLE_CONTACT,
  officeHours: DEFAULT_TEMPLE_OFFICE_HOURS,
};

export const DEFAULT_VISITOR_INFORMATION: VisitorInformation = {
  guidelines: "Remove footwear before entering. Maintain silence and decorum inside the temple.",
  dressCode: "Traditional attire preferred. Saree, Kurta, Dhoti recommended.",
  photographyPolicy: "Photography not allowed inside sanctum. Flash photography prohibited.",
  parking: "Free parking available at main and east entrances.",
  facilities: "Wheelchair access, drinking water, restrooms available.",
  wheelchairAccess: "Wheelchair access at main entrance with ramps.",
  drinkingWater: "RO water available near entrance and Annadanam hall.",
  restrooms: "Available near entrance and parking area.",
  prasada: "Prasada available at counter near exit after darshan.",
  annadanam: "Free meals (Annadanam) available at designated hall. Timings: 12:00 PM - 2:00 PM",
  accommodation: "Guest house available. Contact office for booking.",
  volunteerInfo: "Contact temple office to join volunteer program.",
  testimonials: "Share your spiritual experience at the temple.",
  contact: "Phone: +91-80-28446400, Email: info@raghavendramatha.org",
};

export const DEFAULT_TEMPLE_POLICIES: TemplePolicies = {
  donations: "Donations are welcome. Bank transfers, UPI accepted.",
  information80G: "80G tax exemption available for donations. Contact office for certificate.",
  sevaBooking: "Special sevas can be booked online or at temple counter.",
  onlineServices: "Online donations, seva booking, and darshan booking available.",
  childrenPolicy: "Children welcome. Supervised activities available during festivals.",
  queueGuidelines: "Special queues for senior citizens and differently-abled. General darshan queue available.",
};

export const DEFAULT_AI_RESPONSES: AIResponses = {
  greeting: "🙏 Namaskara! Welcome to Sri Raghavendra Swamy Matha. How may I help you?",
  welcome: "🙏 Welcome! I'm here to help with temple information, darshan timings, sevas, and more.",
  fallback: "🙏 Let me provide you with the most relevant information I have.",
  unknownQuestion: "🙏 I couldn't find verified information about that. Please contact the temple office for confirmation.",
  outOfScope: "🙏 I'm specifically designed to help with temple-related queries. Please contact the temple office for other topics.",
  goodbye: "🙏 Sri Guru Raghavendraya Namaha! Thank you for visiting. Please feel free to return anytime!",
};

export const DEFAULT_AI_BEHAVIOR_SETTINGS: AIBehaviorSettings = {
  confidenceThreshold: 0.85,
  semanticThreshold: 0.7,
  maxRelatedArticles: 3,
  conversationTimeout: 30,
  streaming: false,
  debugMode: false,
  unknownLogging: true,
};

// ==================== DISPLAY NAMES ====================

export const UNKNOWN_QUESTION_STATUS_DISPLAY: Record<UnknownQuestionStatus, string> = {
  pending: "Pending",
  in_review: "In Review",
  resolved: "Resolved",
  added_to_knowledge: "Added to Knowledge",
};

export const PROMPT_STATUS_DISPLAY: Record<PromptVersionStatus, string> = {
  draft: "Draft",
  review: "Review",
  published: "Published",
  archived: "Archived",
};

export const INTENT_STATUS_DISPLAY: Record<IntentStatus, string> = {
  enabled: "Enabled",
  disabled: "Disabled",
};

// Legacy alias for backwards compatibility
export const DEFAULT_AI_RESPONSE_TEMPLATES = DEFAULT_AI_RESPONSES;

// ==================== COMPLETE SETTINGS ====================

export interface AISettings {
  id: string;
  templeInformation: TempleInformation;
  visitorInformation: VisitorInformation;
  templePolicies: TemplePolicies;
  aiResponses: AIResponses;
  aiBehavior: AIBehaviorSettings;
  prompt: PromptSettings;
  intents: IntentSettings;
  updatedAt: Date;
  updatedBy: string;
}

// Type alias for backwards compatibility
export type AIResponseTemplates = AIResponses;
