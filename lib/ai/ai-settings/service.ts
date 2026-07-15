// AI Settings Service
// Business logic layer for AI Management Center

import { aiSettingsRepository } from "./repository";
import {
  AISettings,
  TempleInformation,
  VisitorInformation,
  TemplePolicies,
  AIResponses,
  AIBehaviorSettings,
  PromptSettings,
  PromptVersion,
  IntentSettings,
  IntentMetadata,
  UnknownQuestion,
} from "@/types/ai-settings";

export class AISettingsService {
  // ==================== SETTINGS ====================

  async getAISettings(): Promise<AISettings> {
    let settings = await aiSettingsRepository.getSettings();

    if (!settings) {
      settings = await aiSettingsRepository.createDefaultSettings("system");
    }

    return settings;
  }

  async ensureSettingsExist(userId: string): Promise<AISettings> {
    let settings = await aiSettingsRepository.getSettings();

    if (!settings) {
      settings = await aiSettingsRepository.createDefaultSettings(userId);
    }

    return settings;
  }

  // ==================== TEMPLE INFORMATION ====================

  async getTempleInformation(): Promise<TempleInformation> {
    const settings = await this.getAISettings();
    return settings.templeInformation;
  }

  async updateTempleInformation(
    templeInformation: TempleInformation,
    userId: string
  ): Promise<void> {
    await aiSettingsRepository.updateTempleInformation(templeInformation, userId);
  }

  async updateTempleTimings(
    timings: TempleInformation["timings"],
    userId: string
  ): Promise<void> {
    const current = await this.getTempleInformation();
    await this.updateTempleInformation(
      { ...current, timings },
      userId
    );
  }

  async updateTempleContact(
    contact: TempleInformation["contact"],
    userId: string
  ): Promise<void> {
    const current = await this.getTempleInformation();
    await this.updateTempleInformation(
      { ...current, contact },
      userId
    );
  }

  async updateTempleOfficeHours(
    officeHours: TempleInformation["officeHours"],
    userId: string
  ): Promise<void> {
    const current = await this.getTempleInformation();
    await this.updateTempleInformation(
      { ...current, officeHours },
      userId
    );
  }

  // ==================== VISITOR INFORMATION ====================

  async getVisitorInformation(): Promise<VisitorInformation> {
    const settings = await this.getAISettings();
    return settings.visitorInformation;
  }

  async updateVisitorInformation(
    visitorInformation: VisitorInformation,
    userId: string
  ): Promise<void> {
    await aiSettingsRepository.updateVisitorInformation(visitorInformation, userId);
  }

  async updateVisitorGuidelines(
    visitorGuidelines: VisitorInformation["visitorGuidelines"],
    userId: string
  ): Promise<void> {
    const current = await this.getVisitorInformation();
    await this.updateVisitorInformation(
      { ...current, visitorGuidelines },
      userId
    );
  }

  async updateDressCode(
    dressCode: VisitorInformation["dressCode"],
    userId: string
  ): Promise<void> {
    const current = await this.getVisitorInformation();
    await this.updateVisitorInformation(
      { ...current, dressCode },
      userId
    );
  }

  async updatePhotographyPolicy(
    photographyPolicy: VisitorInformation["photographyPolicy"],
    userId: string
  ): Promise<void> {
    const current = await this.getVisitorInformation();
    await this.updateVisitorInformation(
      { ...current, photographyPolicy },
      userId
    );
  }

  async updateParking(
    parking: VisitorInformation["parking"],
    userId: string
  ): Promise<void> {
    const current = await this.getVisitorInformation();
    await this.updateVisitorInformation(
      { ...current, parking },
      userId
    );
  }

  async updateFacilities(
    facilities: VisitorInformation["facilities"],
    userId: string
  ): Promise<void> {
    const current = await this.getVisitorInformation();
    await this.updateVisitorInformation(
      { ...current, facilities },
      userId
    );
  }

  async updateAnnadanam(
    annadanam: VisitorInformation["annadanam"],
    userId: string
  ): Promise<void> {
    const current = await this.getVisitorInformation();
    await this.updateVisitorInformation(
      { ...current, annadanam },
      userId
    );
  }

  async updateAccommodation(
    accommodation: VisitorInformation["accommodation"],
    userId: string
  ): Promise<void> {
    const current = await this.getVisitorInformation();
    await this.updateVisitorInformation(
      { ...current, accommodation },
      userId
    );
  }

  async updateVolunteerInfo(
    volunteerInfo: VisitorInformation["volunteerInfo"],
    userId: string
  ): Promise<void> {
    const current = await this.getVisitorInformation();
    await this.updateVisitorInformation(
      { ...current, volunteerInfo },
      userId
    );
  }

  // ==================== TEMPLE POLICIES ====================

  async getTemplePolicies(): Promise<TemplePolicies> {
    const settings = await this.getAISettings();
    return settings.templePolicies;
  }

  async updateTemplePolicies(
    templePolicies: TemplePolicies,
    userId: string
  ): Promise<void> {
    await aiSettingsRepository.updateTemplePolicies(templePolicies, userId);
  }

  async updateDonationPolicy(
    donations: TemplePolicies["donations"],
    userId: string
  ): Promise<void> {
    const current = await this.getTemplePolicies();
    await this.updateTemplePolicies(
      { ...current, donations },
      userId
    );
  }

  async update80GPolicy(
    information80G: TemplePolicies["information80G"],
    userId: string
  ): Promise<void> {
    const current = await this.getTemplePolicies();
    await this.updateTemplePolicies(
      { ...current, information80G },
      userId
    );
  }

  async updateSevaBookingPolicy(
    sevaBooking: TemplePolicies["sevaBooking"],
    userId: string
  ): Promise<void> {
    const current = await this.getTemplePolicies();
    await this.updateTemplePolicies(
      { ...current, sevaBooking },
      userId
    );
  }

  // ==================== AI RESPONSES ====================

  async getAIResponses(): Promise<AIResponses> {
    const settings = await this.getAISettings();
    return settings.aiResponses;
  }

  async updateAIResponses(aiResponses: AIResponses, userId: string): Promise<void> {
    await aiSettingsRepository.updateAIResponses(aiResponses, userId);
  }

  async getResponseTemplate(
    templateKey: keyof AIResponses["templates"]
  ): Promise<AIResponses["templates"][typeof templateKey] | null> {
    const aiResponses = await this.getAIResponses();
    return aiResponses.templates[templateKey] || null;
  }

  async updateResponseTemplate(
    templateKey: keyof AIResponses["templates"],
    template: AIResponses["templates"][typeof templateKey],
    userId: string
  ): Promise<void> {
    const current = await this.getAIResponses();
    await this.updateAIResponses(
      {
        ...current,
        templates: {
          ...current.templates,
          [templateKey]: template,
        },
      },
      userId
    );
  }

  async getLocalizedResponse(
    templateKey: keyof AIResponses["templates"],
    language: "en" | "kn" | "mixed"
  ): Promise<string> {
    const template = await this.getResponseTemplate(templateKey);
    if (!template || !template.enabled) {
      return "";
    }
    return template[language] || template.en || "";
  }

  // ==================== AI BEHAVIOR ====================

  async getAIBehavior(): Promise<AIBehaviorSettings> {
    const settings = await this.getAISettings();
    return settings.aiBehavior;
  }

  async updateAIBehavior(aiBehavior: AIBehaviorSettings, userId: string): Promise<void> {
    await aiSettingsRepository.updateAIBehavior(aiBehavior, userId);
  }

  async getConfidenceThreshold(): Promise<number> {
    const behavior = await this.getAIBehavior();
    return behavior.confidenceThreshold.value;
  }

  async setConfidenceThreshold(value: number, userId: string): Promise<void> {
    const current = await this.getAIBehavior();
    await this.updateAIBehavior(
      {
        ...current,
        confidenceThreshold: {
          ...current.confidenceThreshold,
          value: Math.max(
            current.confidenceThreshold.min,
            Math.min(current.confidenceThreshold.max, value)
          ),
        },
      },
      userId
    );
  }

  async getMaxRelatedArticles(): Promise<number> {
    const behavior = await this.getAIBehavior();
    return behavior.maxRelatedArticles.value;
  }

  async setDebugMode(enabled: boolean, userId: string): Promise<void> {
    const current = await this.getAIBehavior();
    await this.updateAIBehavior(
      {
        ...current,
        debugMode: {
          ...current.debugMode,
          enabled,
        },
      },
      userId
    );
  }

  async setStreamingResponses(enabled: boolean, userId: string): Promise<void> {
    const current = await this.getAIBehavior();
    await this.updateAIBehavior(
      {
        ...current,
        streamingResponses: {
          ...current.streamingResponses,
          enabled,
        },
      },
      userId
    );
  }

  // ==================== PROMPT MANAGEMENT ====================

  async getPromptSettings(): Promise<PromptSettings> {
    const settings = await this.getAISettings();
    return settings.prompt;
  }

  async getCurrentPrompt(): Promise<string> {
    const settings = await this.getAISettings();
    const currentVersion = settings.prompt.versions.find(
      (v) => v.id === settings.prompt.currentPromptId
    );
    return currentVersion?.content || settings.prompt.defaultPrompt;
  }

  async getPromptVersions(): Promise<PromptVersion[]> {
    const settings = await this.getAISettings();
    return settings.prompt.versions.sort((a, b) => b.version - a.version);
  }

  async createPromptVersion(
    content: string,
    userId: string,
    changeNotes?: string
  ): Promise<string> {
    return aiSettingsRepository.createPromptVersion(content, userId, changeNotes);
  }

  async updatePromptVersion(
    versionId: string,
    updates: Partial<{
      content: string;
      status: "draft" | "review" | "published" | "archived";
      reviewedBy: string;
      publishedBy: string;
      changeNotes: string;
    }>,
    userId: string
  ): Promise<void> {
    await aiSettingsRepository.updatePromptVersion(versionId, updates, userId);
  }

  async publishPromptVersion(versionId: string, userId: string): Promise<void> {
    await aiSettingsRepository.updatePromptVersion(
      versionId,
      {
        status: "published",
        publishedBy: userId,
      },
      userId
    );
  }

  async rollbackPromptVersion(versionId: string, userId: string): Promise<void> {
    await aiSettingsRepository.rollbackPromptVersion(versionId, userId);
  }

  // ==================== INTENT MANAGEMENT ====================

  async getIntentSettings(): Promise<IntentSettings> {
    const settings = await this.getAISettings();
    return settings.intents;
  }

  async getIntents(): Promise<IntentMetadata[]> {
    const settings = await this.getAISettings();
    return settings.intents.intents;
  }

  async getEnabledIntents(): Promise<IntentMetadata[]> {
    const intents = await this.getIntents();
    return intents.filter((i) => i.status === "enabled");
  }

  async getIntent(intentId: string): Promise<IntentMetadata | null> {
    const intents = await this.getIntents();
    return intents.find((i) => i.intentId === intentId) || null;
  }

  async updateIntent(
    intentId: string,
    updates: Partial<IntentMetadata>,
    userId: string
  ): Promise<void> {
    await aiSettingsRepository.updateIntent(intentId, updates, userId);
  }

  async updateIntentSettings(intentSettings: IntentSettings, userId: string): Promise<void> {
    await aiSettingsRepository.updateIntentSettings(intentSettings, userId);
  }

  async addIntent(intent: IntentMetadata, userId: string): Promise<void> {
    const settings = await this.getIntentSettings();
    const intents = [...settings.intents, intent];
    await this.updateIntentSettings({ intents }, userId);
  }

  async removeIntent(intentId: string, userId: string): Promise<void> {
    const settings = await this.getIntentSettings();
    const intents = settings.intents.filter((i) => i.intentId !== intentId);
    await this.updateIntentSettings({ intents }, userId);
  }

  async toggleIntentStatus(intentId: string, userId: string): Promise<void> {
    const intent = await this.getIntent(intentId);
    if (intent) {
      const newStatus = intent.status === "enabled" ? "disabled" : "enabled";
      await this.updateIntent(intentId, { status: newStatus }, userId);
    }
  }

  async recordIntentUsage(intentId: string): Promise<void> {
    await aiSettingsRepository.incrementIntentUsage(intentId);
  }

  async getTopUsedIntents(limit: number = 10): Promise<IntentMetadata[]> {
    const intents = await this.getIntents();
    return intents
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  // ==================== UNKNOWN QUESTIONS ====================

  async logUnknownQuestion(
    question: string,
    detectedIntent: string,
    confidence: number,
    language: "en" | "kn" | "mixed",
    sessionId: string
  ): Promise<void> {
    const { isNew } = await aiSettingsRepository.checkAndIncrementUnknownQuestion(question);
    
    if (isNew) {
      await aiSettingsRepository.logUnknownQuestion(
        question,
        detectedIntent,
        confidence,
        language,
        sessionId
      );
    }
  }

  async getUnknownQuestions(filters?: {
    status?: string;
    assignedTo?: string;
    limit?: number;
  }): Promise<UnknownQuestion[]> {
    return aiSettingsRepository.getUnknownQuestions(filters);
  }

  async getPendingUnknownQuestions(limit?: number): Promise<UnknownQuestion[]> {
    return aiSettingsRepository.getUnknownQuestions({
      status: "pending",
      limit,
    });
  }

  async updateUnknownQuestion(
    questionId: string,
    updates: Partial<UnknownQuestion>
  ): Promise<void> {
    await aiSettingsRepository.updateUnknownQuestion(questionId, updates);
  }

  async assignUnknownQuestion(
    questionId: string,
    assignedTo: string
  ): Promise<void> {
    await this.updateUnknownQuestion(questionId, {
      assignedTo,
      status: "in_review",
    });
  }

  async resolveUnknownQuestion(
    questionId: string,
    response: string,
    addToKnowledge: boolean = false,
    articleId?: string
  ): Promise<void> {
    await this.updateUnknownQuestion(questionId, {
      status: addToKnowledge ? "added_to_knowledge" : "resolved",
      response,
      ...(addToKnowledge && articleId && { addedToKnowledgeArticleId: articleId }),
    });
  }

  async deleteUnknownQuestion(questionId: string): Promise<void> {
    await aiSettingsRepository.deleteUnknownQuestion(questionId);
  }

  // ==================== UTILITY ====================

  async resetToDefaults(userId: string): Promise<void> {
    await aiSettingsRepository.resetToDefaults(userId);
  }

  async getSettingsSummary(): Promise<{
    lastUpdated: Date;
    updatedBy: string;
    intentCount: number;
    publishedPromptVersion: number | null;
    pendingUnknownQuestions: number;
  }> {
    const settings = await this.getAISettings();
    const pendingQuestions = await this.getPendingUnknownQuestions();

    const publishedVersion = settings.prompt.versions.find(
      (v) => v.id === settings.prompt.currentPromptId
    );

    return {
      lastUpdated: settings.updatedAt,
      updatedBy: settings.updatedBy,
      intentCount: settings.intents.intents.length,
      publishedPromptVersion: publishedVersion?.version || null,
      pendingUnknownQuestions: pendingQuestions.length,
    };
  }
}

// Export singleton instance
export const aiSettingsService = new AISettingsService();
