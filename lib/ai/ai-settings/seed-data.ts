import {
  DEFAULT_AI_GENERAL_SETTINGS,
  DEFAULT_AI_SAFETY_SETTINGS,
  DEFAULT_AI_EXTENDED_BEHAVIOR_SETTINGS,
  DEFAULT_TEMPLE_INFORMATION,
  DEFAULT_VISITOR_INFORMATION,
  DEFAULT_TEMPLE_POLICIES,
  DEFAULT_AI_RESPONSES,
  DEFAULT_AI_BEHAVIOR_SETTINGS,
} from "@/types/ai-settings";

export const seedPromptContent = `You are Raya AI, a helpful virtual assistant for Sri Raghavendra Swamy Matha, Yelahanka.

Your role is to help visitors with:
- Temple timings and darshan information
- Seva bookings and procedures
- Temple history and significance
- Donation information (including 80G certificates)
- Facilities available (parking, wheelchair access, etc.)
- Visitor guidelines and dress code
- General inquiries about the temple

Guidelines:
1. Always be respectful and use Namaskara/Sri Guru Raghavendraya Namaha in greetings
2. Provide accurate information based on available knowledge
3. If unsure, suggest contacting the temple office: +91-80-28446400
4. Keep responses concise but informative
5. Use Kannada (ಕನ್ನಡ) phrases when appropriate for local devotees
6. For complex queries, offer to connect with temple staff

Sri Guru Raghavendraya Namaha! 🙏`;

export const SEED_DEFAULT_INTENTS = [
  {
    id: "INTENT_TIMINGS",
    intentId: "TEMPLE_TIMINGS",
    name: "Temple Timings",
    description: "Questions about temple opening and closing hours",
    status: "enabled" as const,
    keywords: [
      { keyword: "timings", language: "en" as const, isActive: true },
      { keyword: "open", language: "en" as const, isActive: true },
      { keyword: "close", language: "en" as const, isActive: true },
    ],
    examples: [
      { text: "What are the temple timings?", language: "en" as const },
    ],
    confidence: 0.8,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "INTENT_CONTACT",
    intentId: "CONTACT",
    name: "Contact Information",
    description: "Questions about phone number and email",
    status: "enabled" as const,
    keywords: [
      { keyword: "contact", language: "en" as const, isActive: true },
      { keyword: "phone", language: "en" as const, isActive: true },
      { keyword: "call", language: "en" as const, isActive: true },
    ],
    examples: [
      { text: "How can I contact the temple?", language: "en" as const },
    ],
    confidence: 0.8,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: "INTENT_PARKING",
    intentId: "PARKING",
    name: "Parking",
    description: "Questions about parking facilities",
    status: "enabled" as const,
    keywords: [
      { keyword: "parking", language: "en" as const, isActive: true },
      { keyword: "car", language: "en" as const, isActive: true },
    ],
    examples: [
      { text: "Is there parking available?", language: "en" as const },
    ],
    confidence: 0.8,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  }
];

export const getDefaultSeedPayload = (userId: string) => ({
  id: "main",
  general: DEFAULT_AI_GENERAL_SETTINGS,
  safety: DEFAULT_AI_SAFETY_SETTINGS,
  extended_behavior: DEFAULT_AI_EXTENDED_BEHAVIOR_SETTINGS,
  temple_information: DEFAULT_TEMPLE_INFORMATION,
  visitor_information: DEFAULT_VISITOR_INFORMATION,
  temple_policies: DEFAULT_TEMPLE_POLICIES,
  ai_responses: DEFAULT_AI_RESPONSES,
  ai_behavior: DEFAULT_AI_BEHAVIOR_SETTINGS,
  prompt: {
      currentPromptId: "prompt_v1_seed",
      versions: [{
          id: "prompt_v1_seed",
          name: "Prompt v1",
          version: 1,
          content: seedPromptContent,
          status: "published",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: userId
      }],
      defaultPrompt: seedPromptContent,
  },
  intents: { intents: SEED_DEFAULT_INTENTS },
  updated_at: new Date().toISOString(),
  updated_by: userId,
  version: 1
});
