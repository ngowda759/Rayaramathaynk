import { z } from "zod";

export const AIGeneralSettingsSchema = z.object({
  enabled: z.boolean(),
  botName: z.string(),
  botSubtitle: z.string(),
  welcomeMessage: z.string(),
  closingMessage: z.string(),
  defaultLanguage: z.enum(["en", "kn", "mixed"]),
  supportedLanguages: z.array(z.enum(["en", "kn", "mixed"])),
});

export const AISafetySettingsSchema = z.object({
  retrievalRequired: z.boolean(),
  allowLLMOnlyResponse: z.boolean(),
  requireSourceForFacts: z.boolean(),
  unknownQuestionBehaviour: z.enum(["fallback", "escalate", "silent"]),
  outOfScopeBehaviour: z.enum(["fallback", "strict", "silent"]),
});

export const AIExtendedBehaviorSettingsSchema = z.object({
  confidenceThreshold: z.number().min(0).max(1),
  semanticThreshold: z.number().min(0).max(1),
  maxRelatedArticles: z.number().int().min(1),
  conversationTimeout: z.number().int().min(1),
  streaming: z.boolean(),
  debugMode: z.boolean(),
  unknownLogging: z.boolean(),
  enableFollowUpContext: z.boolean(),
  enableSuggestedQuestions: z.boolean(),
  enableAnalytics: z.boolean(),
  enableUnknownQuestionLogging: z.boolean(),
  enableDebugMode: z.boolean().optional(),
  maxKnowledgeResults: z.number().int().min(1),
});

export const TempleInformationSchema = z.object({
  timings: z.object({
    morningOpen: z.string(),
    morningClose: z.string(),
    eveningOpen: z.string(),
    eveningClose: z.string(),
  }),
  contact: z.object({
    phone: z.string(),
    email: z.string(),
    address: z.string(),
    googleMapsUrl: z.string().optional(),
  }),
  officeHours: z.object({
    weekday: z.string(),
    weekend: z.string(),
    notes: z.string().optional(),
  }),
});

export const VisitorInformationSchema = z.object({
  guidelines: z.string(),
  dressCode: z.string(),
  photographyPolicy: z.string(),
  parking: z.string(),
  facilities: z.string(),
  wheelchairAccess: z.string(),
  drinkingWater: z.string(),
  restrooms: z.string(),
  prasada: z.string(),
  annadanam: z.string(),
  accommodation: z.string(),
  volunteerInfo: z.string(),
  testimonials: z.string(),
  contact: z.string(),
});

export const TemplePoliciesSchema = z.object({
  donations: z.string(),
  information80G: z.string(),
  sevaBooking: z.string(),
  onlineServices: z.string(),
  childrenPolicy: z.string(),
  queueGuidelines: z.string(),
});

export const AIResponsesSchema = z.object({
  greeting: z.string(),
  welcome: z.string(),
  fallback: z.string(),
  unknownQuestion: z.string(),
  outOfScope: z.string(),
  goodbye: z.string(),
});

export const PromptSettingsSchema = z.object({
  currentPromptId: z.string(),
  defaultPrompt: z.string(),
  versions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.number(),
      content: z.string(),
      status: z.enum(["draft", "review", "published", "archived"]),
      createdAt: z.union([z.string(), z.date()]).transform((val) => new Date(val)),
      updatedAt: z.union([z.string(), z.date()]).transform((val) => new Date(val)),
      createdBy: z.string(),
      reviewedBy: z.string().optional(),
      publishedAt: z.union([z.string(), z.date()]).transform((val) => new Date(val)).optional(),
      publishedBy: z.string().optional(),
      rollbackOf: z.string().optional(),
      changeNotes: z.string().optional(),
    })
  ),
});

export const IntentSettingsSchema = z.object({
  intents: z.array(
    z.object({
      id: z.string().optional(),
      intentId: z.string().optional(),
      name: z.string(),
      description: z.string(),
      status: z.enum(["enabled", "disabled"]),
      keywords: z.array(
        z.object({
          keyword: z.string(),
          language: z.enum(["en", "kn"]),
          isActive: z.boolean(),
        })
      ),
      examples: z.array(
        z.object({
          text: z.string(),
          language: z.enum(["en", "kn"]),
        })
      ),
      confidence: z.number().min(0).max(1),
      successRate: z.number().optional(),
      knowledgeSource: z.string().optional(),
      route: z.string().optional(),
      usageCount: z.number(),
      lastUsed: z.union([z.string(), z.date()]).transform((val) => new Date(val)).optional(),
      createdAt: z.union([z.string(), z.date()]).transform((val) => new Date(val)),
      updatedAt: z.union([z.string(), z.date()]).transform((val) => new Date(val)).optional(),
    })
  ),
});

export const AISettingsSchema = z.object({
  id: z.string(),
  general: AIGeneralSettingsSchema,
  safety: AISafetySettingsSchema,
  extendedBehavior: AIExtendedBehaviorSettingsSchema,
  templeInformation: TempleInformationSchema,
  visitorInformation: VisitorInformationSchema,
  templePolicies: TemplePoliciesSchema,
  aiResponses: AIResponsesSchema,
  aiBehavior: z.any(), // Legacy map
  prompt: PromptSettingsSchema,
  intents: IntentSettingsSchema,
  updatedAt: z.union([z.string(), z.date()]).transform((val) => new Date(val)),
  updatedBy: z.string(),
});
