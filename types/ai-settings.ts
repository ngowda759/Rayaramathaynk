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
  weekday: {
    open: string;
    close: string;
  };
  saturday: {
    open: string;
    close: string;
  };
  sunday: {
    open: string;
    close: string;
  };
  holidays?: string;
  notes?: string;
}

export interface TempleInformation {
  timings: TempleTimings;
  contact: TempleContact;
  officeHours: TempleOfficeHours;
}

// ==================== VISITOR INFORMATION ====================

export interface VisitorGuideline {
  title: string;
  content: string;
  order: number;
}

export interface VisitorInformation {
  visitorGuidelines: VisitorGuideline[];
  dressCode: {
    title: string;
    description: string;
    allowedAttire?: string[];
    notAllowedAttire?: string[];
  };
  photographyPolicy: {
    title: string;
    content: string;
    isAllowed: boolean;
    restrictions?: string[];
  };
  parking: {
    title: string;
    description: string;
    isFree: boolean;
    capacity?: string;
    twoWheelerParking?: string;
    fourWheelerParking?: string;
  };
  facilities: {
    title: string;
    items: Array<{
      name: string;
      available: boolean;
      location?: string;
      description?: string;
      notes?: string;
    }>;
  };
  wheelchairAccess: {
    available: boolean;
    description: string;
    entryPoints?: string[];
  };
  drinkingWater: {
    available: boolean;
    locations?: string[];
    notes?: string;
  };
  restrooms: {
    available: boolean;
    maleLocation?: string;
    femaleLocation?: string;
    wheelchairAccessible?: string[];
  };
  prasada: {
    title: string;
    description: string;
    timings?: string;
    location?: string;
  };
  annadanam: {
    title: string;
    description: string;
    timings?: string;
    location?: string;
    isAvailable: boolean;
  };
  accommodation: {
    available: boolean;
    description: string;
    contactInfo?: string;
    bookingProcess?: string;
  };
  volunteerInfo: {
    title: string;
    description: string;
    howToJoin: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  testimonials: {
    title: string;
    description: string;
    ctaText: string;
  };
  contactInfo: {
    title: string;
    emergency?: string;
    generalEnquiries?: string;
  };
}

// ==================== TEMPLE POLICIES ====================

export interface DonationPolicy {
  title: string;
  description: string;
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    branch: string;
    ifsc: string;
  };
  upiId?: string;
  qrCodeUrl?: string;
}

export interface Information80G {
  title: string;
  description: string;
  has80G: boolean;
  certificateProcess?: string;
  contactEmail?: string;
}

export interface SevaBookingPolicy {
  title: string;
  description: string;
  bookingUrl?: string;
  advanceBookingDays?: number;
  cancellationPolicy?: string;
}

export interface OnlineServices {
  title: string;
  description: string;
  availableServices?: string[];
  url?: string;
}

export interface ChildrenPolicy {
  title: string;
  description: string;
  ageRestrictions?: string;
  facilities?: string[];
}

export interface QueueGuidelines {
  title: string;
  description: string;
  specialQueues?: Array<{
    name: string;
    description: string;
  }>;
  generalGuidelines?: string[];
}

export interface TemplePolicies {
  donations: DonationPolicy;
  information80G: Information80G;
  sevaBooking: SevaBookingPolicy;
  onlineServices: OnlineServices;
  childrenPolicy: ChildrenPolicy;
  queueGuidelines: QueueGuidelines;
}

// ==================== AI RESPONSES ====================

export interface AIResponseTemplates {
  greeting: {
    enabled: boolean;
    en: string;
    kn: string;
    mixed: string;
  };
  welcomeMessage: {
    enabled: boolean;
    en: string;
    kn: string;
    mixed: string;
  };
  fallbackMessage: {
    enabled: boolean;
    en: string;
    kn: string;
    mixed: string;
  };
  unknownQuestionResponse: {
    enabled: boolean;
    en: string;
    kn: string;
    mixed: string;
  };
  outOfScopeResponse: {
    enabled: boolean;
    en: string;
    kn: string;
    mixed: string;
  };
  goodbyeMessage: {
    enabled: boolean;
    en: string;
    kn: string;
    mixed: string;
  };
}

export interface AIResponses {
  templates: AIResponseTemplates;
}

// ==================== AI BEHAVIOR SETTINGS ====================

export interface AIBehaviorSettings {
  confidenceThreshold: {
    value: number;
    description: string;
    min: number;
    max: number;
  };
  maxRelatedArticles: {
    value: number;
    description: string;
    min: number;
    max: number;
  };
  conversationTimeout: {
    value: number;
    description: string;
    unit: string;
  };
  semanticMatchThreshold: {
    value: number;
    description: string;
    min: number;
    max: number;
  };
  unknownQuestionLogging: {
    enabled: boolean;
    description: string;
  };
  debugMode: {
    enabled: boolean;
    description: string;
  };
  streamingResponses: {
    enabled: boolean;
    description: string;
  };
}

// ==================== PROMPT MANAGEMENT ====================

export interface PromptVersion {
  id: string;
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
  intentId: string;
  name: string;
  description: string;
  status: IntentStatus;
  keywords: IntentKeyword[];
  examples: IntentExample[];
  baseConfidence: number;
  knowledgeSource?: string;
  route?: string;
  usageCount: number;
  lastUsed?: Date;
}

export interface IntentSettings {
  intents: IntentMetadata[];
}

// ==================== UNKNOWN QUESTIONS ====================

export interface UnknownQuestion {
  id: string;
  question: string;
  questionLower: string;
  detectedIntent: string;
  confidence: number;
  language: AISettingsLanguage;
  timestamp: Date;
  sessionId: string;
  timesAsked: number;
  status: UnknownQuestionStatus;
  assignedTo: UnknownQuestionAssignedTo;
  reviewedBy?: string;
  reviewedAt?: Date;
  response?: string;
  addedToKnowledgeArticleId?: string;
  notes?: string;
}

// ==================== COMPLETE AI SETTINGS ====================

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

// ==================== DEFAULT VALUES ====================

export const DEFAULT_TEMPLE_TIMINGS: TempleTimings = {
  morningOpen: "6:00 AM",
  morningClose: "12:30 PM",
  eveningOpen: "5:00 PM",
  eveningClose: "8:30 PM",
  specialNotes: "Festival timings may vary. Please check official announcements.",
};

export const DEFAULT_TEMPLE_CONTACT: TempleContact = {
  phone: "+91-80-28446400",
  email: "info@raghavendramatha.org",
  address: "Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru - 560064, Karnataka, India",
  googleMapsUrl: "https://maps.google.com/?q=Sri+Raghavendra+Swamy+Matha+Yelahanka",
};

export const DEFAULT_TEMPLE_OFFICE_HOURS: TempleOfficeHours = {
  weekday: {
    open: "9:00 AM",
    close: "5:00 PM",
  },
  saturday: {
    open: "9:00 AM",
    close: "5:00 PM",
  },
  sunday: {
    open: "10:00 AM",
    close: "4:00 PM",
  },
  notes: "Office closed on temple holidays.",
};

export const DEFAULT_VISITOR_INFORMATION: VisitorInformation = {
  visitorGuidelines: [
    { title: "Temple Entry", content: "Remove footwear before entering the temple premises. Maintain silence and decorum inside the temple.", order: 1 },
    { title: "Offerings", content: "Flowers and coconuts can be purchased at the temple counters. Do not bring outside offerings.", order: 2 },
    { title: "Dress Code", content: "Traditional attire is preferred. Please refer to the dress code section for details.", order: 3 },
    { title: "Photography", content: "Photography is not allowed inside the sanctum. Please check the photography policy.", order: 4 },
    { title: "Mobile Phones", content: "Please keep mobile phones on silent mode inside the temple.", order: 5 },
  ],
  dressCode: {
    title: "Dress Code Guidelines",
    description: "Traditional and modest attire is recommended for all visitors to the temple.",
    allowedAttire: [
      "Traditional Indian wear (Saree, Kurta, Dhoti for women; Kurta, Dhoti, Panche for men)",
      "Clean casual wear",
      "Formal attire",
    ],
    notAllowedAttire: [
      "Shorts and miniskirts",
      "Tank tops and sleeveless tops",
      "Revealing clothing",
      "Footwear inside the temple",
    ],
  },
  photographyPolicy: {
    title: "Photography Guidelines",
    content: "Photography helps preserve memories of your spiritual journey. Please follow these guidelines.",
    isAllowed: true,
    restrictions: [
      "Photography is NOT allowed inside the sanctum (Garbha Griha)",
      "Flash photography is not permitted anywhere inside the temple",
      "Videography requires special permission",
      "Be respectful of other devotees while taking photos",
    ],
  },
  parking: {
    title: "Parking Facilities",
    description: "The temple provides free parking facilities for all visitors.",
    isFree: true,
    twoWheelerParking: "Available at the east entrance",
    fourWheelerParking: "Available at the main entrance and west side",
  },
  facilities: {
    title: "Temple Facilities",
    items: [
      { name: "Drinking Water", available: true, location: "Near entrance and near Annadanam hall" },
      { name: "Restrooms", available: true, location: "Near entrance and parking area" },
      { name: "Wheelchair Access", available: true, description: "Available at main entrance" },
      { name: "Annadanam Hall", available: true, location: "South side of the temple" },
      { name: "Prasada Counter", available: true, location: "Near exit" },
    ],
  },
  wheelchairAccess: {
    available: true,
    description: "Wheelchair access is available at the main entrance. Ramps are provided for easy access.",
    entryPoints: ["Main Entrance", "East Side Entrance"],
  },
  drinkingWater: {
    available: true,
    locations: ["Near main entrance", "Near Annadanam hall", "Near parking area"],
    notes: "RO water is available at all water stations.",
  },
  restrooms: {
    available: true,
    maleLocation: "Near east entrance",
    femaleLocation: "Near parking area",
    wheelchairAccessible: ["Near main entrance"],
  },
  prasada: {
    title: "Prasada Distribution",
    description: "Prasada (sacred food) is distributed daily after the evening aarati.",
    timings: "After evening aarati (around 8:00 PM)",
    location: "Near the prasada counter",
  },
  annadanam: {
    title: "Annadanam - Free Meals",
    description: "Free meals (Annadanam) are served daily to all devotees.",
    isAvailable: true,
    timings: "12:00 PM to 3:00 PM",
    location: "Annadanam Hall, South side",
  },
  accommodation: {
    available: false,
    description: "The temple does not provide accommodation facilities. Nearby hotels are available.",
    contactInfo: "Please contact the temple office for recommendations.",
  },
  volunteerInfo: {
    title: "Volunteer Information",
    description: "We welcome devotees who wish to volunteer their services at the temple.",
    howToJoin: "Contact the temple office or speak to our volunteer coordinator during your visit.",
    contactEmail: "volunteer@raghavendramatha.org",
    contactPhone: "+91-80-28446400",
  },
  testimonials: {
    title: "Share Your Experience",
    description: "We would love to hear about your spiritual experience at our temple.",
    ctaText: "Share Your Experience",
  },
  contactInfo: {
    title: "Temple Contact",
    generalEnquiries: "+91-80-28446400",
    emergency: "+91-80-28446401",
  },
};

export const DEFAULT_TEMPLE_POLICIES: TemplePolicies = {
  donations: {
    title: "Donation Guidelines",
    description: "Your generous donations help us maintain temple operations and serve devotees.",
    upiId: "raghavendra@upi",
  },
  information80G: {
    title: "80G Tax Benefits",
    description: "Donations to Sri Raghavendra Swamy Matha are eligible for tax deduction under Section 80G of the Income Tax Act.",
    has80G: true,
    certificateProcess: "Request 80G certificate at the temple office with your donation receipt.",
    contactEmail: "donation@raghavendramatha.org",
  },
  sevaBooking: {
    title: "Seva Booking",
    description: "Book sevas online or at the temple counter.",
    advanceBookingDays: 30,
    cancellationPolicy: "Cancellations must be made 24 hours in advance for a full refund.",
  },
  onlineServices: {
    title: "Online Services",
    description: "Access temple services online from anywhere.",
    availableServices: [
      "Online Seva Booking",
      "Donations",
      "View Announcements",
      "Gallery",
    ],
    url: "/donate",
  },
  childrenPolicy: {
    title: "Children Policy",
    description: "Children of all ages are welcome at the temple.",
    facilities: [
      "Children must be supervised by parents at all times",
      "No entry for children in arms during peak hours",
    ],
  },
  queueGuidelines: {
    title: "Queue Guidelines",
    description: "Please follow queue guidelines for a peaceful darshan.",
    generalGuidelines: [
      "Maintain queue discipline",
      "Follow staff instructions",
      "Senior citizens and differently-abled will be given priority",
      "No pushing or crowding",
    ],
  },
};

export const DEFAULT_AI_RESPONSE_TEMPLATES: AIResponseTemplates = {
  greeting: {
    enabled: true,
    en: "🙏 Namaskara! Welcome to Sri Raghavendra Swamy Matha. I am Raya AI, your virtual assistant. How may I help you today?",
    kn: "🙏 ನಮಸ್ಕಾರ! ಶ್ರೀ ರಾಗವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠಕ್ಕೆ ಸ್ವಾಗತ. ನಾವು ರಾಯ, ನಿಮ್ಮ ವರ್ಚುವಲ್ ಸಹಾಯಕ. ಇಂದು ನಾವು ನಿಮ್ಮ ಹೆಗಲು ಸಹಾಯ?",
    mixed: "🙏 Namaskara / ನಮಸ್ಕಾರ! Welcome to Sri Raghavendra Swamy Matha. ನಾವು ರಾಯ, ನಿಮ್ಮ ಸಹಾಯಕ.",
  },
  welcomeMessage: {
    enabled: true,
    en: "🙏 Welcome to Sri Raghavendra Swamy Matha! I'm here to help you with temple information, darshan timings, sevas, and more.",
    kn: "🙏 ಶ್ರೀ ರಾಗವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠಕ್ಕೆ ಸ್ವಾಗತ! ದರ್ಶನ ಮಾಹಿತಿ, ದರ್ಶನ ಸಮಯ, ಸೇವೆಗಳು ಮತ್ತು ಇತರೆ ವಿಷಯಗಳಲ್ಲಿ ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ನಾನಿದ್ದೇನೆ.",
    mixed: "🙏 Welcome / ಸ್ವಾಗತ! ನಾವು ನಿಮ್ಮ ಸಹಾಯ ಮಾಡಲು ಇದ್ದೇವೆ.",
  },
  fallbackMessage: {
    enabled: true,
    en: "🙏 I understand your question, but I need to process this information. Let me provide you with the most relevant details I have.",
    kn: "🙏 ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯ ಕೊಟ್ಟು ನೋಡಿ.",
    mixed: "🙏 Let me check / ಸ್ವಲ್ಪ ನೋಡಿ.",
  },
  unknownQuestionResponse: {
    enabled: true,
    en: "🙏 I couldn't find verified information about that. Please contact the temple office for confirmation. Temple Phone: +91-80-28446400",
    kn: "🙏 ಇತರ ಬಗ್ಗೆ ಖಚಿತ ಮಾಹಿತಿ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ. ದೇವಸ್ಥಾನ ಫೋನ್: +91-80-28446400",
    mixed: "🙏 ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ / Please contact temple office.",
  },
  outOfScopeResponse: {
    enabled: true,
    en: "🙏 I appreciate your question, but I'm specifically designed to help with Sri Raghavendra Swamy Matha related queries. For other topics, please contact the temple office directly.",
    kn: "🙏 ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಅಷ್ಟೆ ಹೊರತು ಶ್ರೀ ರಾಗವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದ ವಿಷಯಗಳಿಗೆ ನಾನು ಮಾತ್ರ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.",
    mixed: "🙏 I'm here to help with temple queries / ದೇವಸ್ಥಾನದ ವಿಷಯಗಳಿಗೆ ನಾನಿದ್ದೇನೆ.",
  },
  goodbyeMessage: {
    enabled: true,
    en: "🙏 Sri Guru Raghavendraya Namaha! Thank you for visiting. May your journey be blessed. Please feel free to return anytime!",
    kn: "🙏 ಶ್ರೀ ಗುರು ರಾಗವೇಂದ್ರಾಯ ನಮಃ! ಭೇಟಿಯಾಗಿ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಪ್ರಯಾಣ ಶುಭವಾಗಲಿ. ಯಾವುದೇ ಸಮಯದಲ್ಲಿ ಮರಳಿ ಬನ್ನಿ!",
    mixed: "🙏 Thank you / ಧನ್ಯವಾದಗಳು! Sri Guru Raghavendraya Namaha!",
  },
};

export const DEFAULT_AI_BEHAVIOR_SETTINGS: AIBehaviorSettings = {
  confidenceThreshold: {
    value: 85,
    description: "Minimum confidence score required to return a response without logging as unknown question",
    min: 50,
    max: 100,
  },
  maxRelatedArticles: {
    value: 3,
    description: "Maximum number of related articles to show in a response",
    min: 1,
    max: 5,
  },
  conversationTimeout: {
    value: 30,
    description: "Time in minutes before a conversation is considered inactive",
    unit: "minutes",
  },
  semanticMatchThreshold: {
    value: 0.7,
    description: "Minimum semantic similarity score for knowledge base matches",
    min: 0.5,
    max: 1.0,
  },
  unknownQuestionLogging: {
    enabled: true,
    description: "Log questions that fall below the confidence threshold for review",
  },
  debugMode: {
    enabled: false,
    description: "Enable debug mode to show intent detection and confidence scores",
  },
  streamingResponses: {
    enabled: false,
    description: "Stream responses token by token (requires compatible AI provider)",
  },
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
