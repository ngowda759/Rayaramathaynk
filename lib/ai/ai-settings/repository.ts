import { createAdminClient } from "@/lib/supabase/admin";
import { AISettingsSchema } from "./validation";

import {
  AISettings,
  AIGeneralSettings,
  AISafetySettings,
  AIExtendedBehaviorSettings,
  TempleInformation,
  VisitorInformation,
  TemplePolicies,
  AIResponses,
  AIBehaviorSettings,
  PromptSettings,
  IntentSettings,
  UnknownQuestion,
  DEFAULT_AI_GENERAL_SETTINGS,
  DEFAULT_AI_SAFETY_SETTINGS,
  DEFAULT_AI_EXTENDED_BEHAVIOR_SETTINGS,
  DEFAULT_TEMPLE_INFORMATION,
  DEFAULT_TEMPLE_TIMINGS,
  DEFAULT_TEMPLE_CONTACT,
  DEFAULT_TEMPLE_OFFICE_HOURS,
  DEFAULT_VISITOR_INFORMATION,
  DEFAULT_TEMPLE_POLICIES,
  DEFAULT_AI_RESPONSES,
  DEFAULT_AI_BEHAVIOR_SETTINGS,
} from "@/types/ai-settings";

const AI_SETTINGS_DOC_ID = "main";
const UNKNOWN_QUESTIONS_COLLECTION = "unknown_questions";

export class AISettingsRepository {
  private getSupabase() {
    return createAdminClient();
  }

  // ==================== CORE SETTINGS ====================

  async getSettings(): Promise<AISettings | null> {
    const { data, error } = await this.getSupabase()
      .from("ai_settings")
      .select("*")
      .eq("id", AI_SETTINGS_DOC_ID)
      .maybeSingle();

    if (error) {
      console.error("Error fetching AI Settings from Supabase:", error);
      return null;
    }

    if (data) {
      const parsedData = {
        id: data.id,
        general: data.general,
        safety: data.safety,
        extendedBehavior: data.extended_behavior,
        templeInformation: data.temple_information,
        visitorInformation: data.visitor_information,
        templePolicies: data.temple_policies,
        aiResponses: data.ai_responses,
        aiBehavior: data.ai_behavior,
        prompt: data.prompt,
        intents: data.intents,
        updatedAt: data.updated_at,
        updatedBy: data.updated_by,
      };

      const parsed = AISettingsSchema.safeParse(parsedData);
      if (!parsed.success) {
        console.error("Invalid AI Settings found in database:", parsed.error);
        return null;
      }
      return parsed.data as AISettings;
    }

    return null;
  }

  async createDefaultSettings(userId: string): Promise<AISettings> {
    const defaultSettings: AISettings = {
      id: AI_SETTINGS_DOC_ID,
      general: DEFAULT_AI_GENERAL_SETTINGS,
      safety: DEFAULT_AI_SAFETY_SETTINGS,
      extendedBehavior: DEFAULT_AI_EXTENDED_BEHAVIOR_SETTINGS,
      templeInformation: DEFAULT_TEMPLE_INFORMATION,
      visitorInformation: DEFAULT_VISITOR_INFORMATION,
      templePolicies: DEFAULT_TEMPLE_POLICIES,
      aiResponses: DEFAULT_AI_RESPONSES,
      aiBehavior: DEFAULT_AI_BEHAVIOR_SETTINGS,
      prompt: {
        currentPromptId: "",
        versions: [],
        defaultPrompt: this.getDefaultPrompt(),
      },
      intents: {
        intents: [],
      },
      updatedAt: new Date(),
      updatedBy: userId,
    };

    const parsed = AISettingsSchema.parse(defaultSettings);

    const { error } = await this.getSupabase().from("ai_settings").upsert({
      id: AI_SETTINGS_DOC_ID,
      general: parsed.general,
      safety: parsed.safety,
      extended_behavior: parsed.extendedBehavior,
      temple_information: parsed.templeInformation,
      visitor_information: parsed.visitorInformation,
      temple_policies: parsed.templePolicies,
      ai_responses: parsed.aiResponses,
      ai_behavior: parsed.aiBehavior,
      prompt: parsed.prompt,
      intents: parsed.intents,
      updated_by: userId,
    });

    if (error) {
      console.error("Error creating default settings:", error);
      throw error;
    }

    return parsed as AISettings;
  }

  async updateSettings(settings: Partial<AISettings>, userId: string): Promise<void> {
    const updateData: any = {
      updated_by: userId,
    };

    if (settings.general) updateData.general = settings.general;
    if (settings.safety) updateData.safety = settings.safety;
    if (settings.extendedBehavior) updateData.extended_behavior = settings.extendedBehavior;
    if (settings.templeInformation) updateData.temple_information = settings.templeInformation;
    if (settings.visitorInformation) updateData.visitor_information = settings.visitorInformation;
    if (settings.templePolicies) updateData.temple_policies = settings.templePolicies;
    if (settings.aiResponses) updateData.ai_responses = settings.aiResponses;
    if (settings.aiBehavior) updateData.ai_behavior = settings.aiBehavior;
    if (settings.prompt) updateData.prompt = settings.prompt;
    if (settings.intents) updateData.intents = settings.intents;

    const { error } = await this.getSupabase()
      .from("ai_settings")
      .update(updateData)
      .eq("id", AI_SETTINGS_DOC_ID);

    if (error) {
      console.error("Error updating AI Settings:", error);
      throw error;
    }
  }

  // ==================== SPECIFIC UPDATE METHODS ====================

  async updateTempleInformation(
    templeInfo: Partial<{
      timings: any;
      contact: any;
      officeHours: any;
    }>,
    userId: string
  ): Promise<void> {
    const currentSettings = await this.getSettings();
    if (!currentSettings) throw new Error("Settings not found");

    const newTempleInfo = { ...currentSettings.templeInformation, ...templeInfo };
    await this.updateSettings({ templeInformation: newTempleInfo }, userId);
  }

  async updateVisitorInformation(
    visitorInfo: Partial<VisitorInformation>,
    userId: string
  ): Promise<void> {
    const currentSettings = await this.getSettings();
    if (!currentSettings) throw new Error("Settings not found");

    const newVisitorInfo = { ...currentSettings.visitorInformation, ...visitorInfo };
    await this.updateSettings({ visitorInformation: newVisitorInfo as VisitorInformation }, userId);
  }

  async updateTemplePolicies(
    templePolicies: Partial<TemplePolicies>,
    userId: string
  ): Promise<void> {
    const currentSettings = await this.getSettings();
    if (!currentSettings) throw new Error("Settings not found");

    const newTemplePolicies = { ...currentSettings.templePolicies, ...templePolicies };
    await this.updateSettings({ templePolicies: newTemplePolicies as TemplePolicies }, userId);
  }

  async updateAIResponses(aiResponses: AIResponses, userId: string): Promise<void> {
    await this.updateSettings({ aiResponses }, userId);
  }

  async updateAIBehavior(aiBehavior: AIBehaviorSettings, userId: string): Promise<void> {
    await this.updateSettings({ aiBehavior }, userId);
  }

  // ==================== PROMPT MANAGEMENT ====================

  async updatePromptSettings(promptSettings: PromptSettings, userId: string): Promise<void> {
    await this.updateSettings({ prompt: promptSettings }, userId);
  }

  async createPromptVersion(
    content: string,
    userId: string,
    changeNotes?: string,
    name?: string,
    status?: "draft" | "review" | "published" | "archived"
  ): Promise<string> {
    let settings = await this.getSettings();

    if (!settings) {
      settings = await this.createDefaultSettings(userId);
    }

    const versions = settings.prompt.versions || [];
    const newVersionNumber = versions.length > 0 
      ? Math.max(...versions.map(v => v.version)) + 1 
      : 1;

    const newVersion = {
      id: `prompt_v${newVersionNumber}_${Date.now()}`,
      name: name || `Prompt v${newVersionNumber}`,
      version: newVersionNumber,
      content,
      status: status || "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      changeNotes: changeNotes || "",
    };

    versions.push(newVersion as any);

    await this.updatePromptSettings(
      {
        ...settings.prompt,
        versions,
      },
      userId
    );

    return newVersion.id;
  }

  async updatePromptVersion(
    versionId: string,
    updates: Partial<{
      content: string;
      status: "draft" | "review" | "published" | "archived";
      reviewedBy: string;
      publishedBy: string;
      publishedAt: Date;
      changeNotes: string;
    }>,
    userId: string
  ): Promise<void> {
    const settings = await this.getSettings();
    if (!settings) {
      throw new Error("AI Settings not found");
    }

    const versions = settings.prompt.versions.map((v) => {
      if (v.id === versionId) {
        return {
          ...v,
          ...updates,
          updatedAt: new Date(),
        };
      }
      return v;
    });

    if (updates.status === "published") {
      const versionIndex = versions.findIndex((v) => v.id === versionId);
      if (versionIndex !== -1) {
        versions[versionIndex].publishedAt = new Date();
        versions[versionIndex].publishedBy = updates.publishedBy || userId;
      }
    }

    await this.updatePromptSettings(
      {
        ...settings.prompt,
        versions,
        currentPromptId: updates.status === "published" ? versionId : settings.prompt.currentPromptId,
      },
      userId
    );
  }

  async rollbackPromptVersion(versionId: string, userId: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings) {
      throw new Error("AI Settings not found");
    }

    const versionToRollback = settings.prompt.versions.find((v) => v.id === versionId);
    if (!versionToRollback) {
      throw new Error("Version not found");
    }

    // Archive current published version
    const versions = settings.prompt.versions.map((v) => {
      if (v.id === settings.prompt.currentPromptId) {
        return { ...v, status: "archived" as const, updatedAt: new Date() };
      }
      return v;
    });

    // Create a new version based on the rollback target
    const newVersionNumber = Math.max(...versions.map((v) => v.version)) + 1;
    const rolledBackVersion = {
      id: `prompt_v${newVersionNumber}_${Date.now()}`,
      name: `Prompt v${newVersionNumber}`,
      version: newVersionNumber,
      content: versionToRollback.content,
      status: "published" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      rollbackOf: versionId,
      publishedAt: new Date(),
      publishedBy: userId,
      changeNotes: `Rolled back from version ${versionToRollback.version}`,
    };

    versions.push(rolledBackVersion);

    await this.updatePromptSettings(
      {
        ...settings.prompt,
        versions,
        currentPromptId: rolledBackVersion.id,
      },
      userId
    );
  }

  // ==================== INTENT MANAGEMENT ====================

  async updateIntentSettings(intentSettings: IntentSettings, userId: string): Promise<void> {
    await this.updateSettings({ intents: intentSettings }, userId);
  }

  async updateIntent(
    intentId: string,
    updates: Partial<{
      name: string;
      description: string;
      status: "enabled" | "disabled";
      keywords: Array<{ keyword: string; language: "en" | "kn"; isActive: boolean }>;
      examples: Array<{ text: string; language: "en" | "kn" }>;
      baseConfidence: number;
      knowledgeSource: string;
      route: string;
    }>,
    userId: string
  ): Promise<void> {
    const settings = await this.getSettings();
    if (!settings) {
      throw new Error("AI Settings not found");
    }

    const intents = settings.intents.intents.map((i) => {
      if (i.intentId === intentId || i.id === intentId) {
        return {
          ...i,
          ...updates,
        };
      }
      return i;
    });

    await this.updateIntentSettings({ intents }, userId);
  }

  async incrementIntentUsage(intentId: string): Promise<void> {
    const settings = await this.getSettings();
    if (!settings) return;

    const intents = settings.intents.intents.map((i) => {
      if (i.intentId === intentId || i.id === intentId) {
        return {
          ...i,
          usageCount: (i.usageCount || 0) + 1,
          lastUsed: new Date(),
        };
      }
      return i;
    });

    await this.updateIntentSettings({ intents }, "system");
  }

  // ==================== UNKNOWN QUESTIONS ====================

  async logUnknownQuestion(
    question: string,
    detectedIntent: string,
    confidence: number,
    language: "en" | "kn" | "mixed",
    sessionId: string
  ): Promise<void> {
    const { error } = await this.getSupabase()
      .from('unknown_questions')
      .insert([{
        question,
        question_lower: question.toLowerCase(),
        detected_intent: detectedIntent,
        confidence,
        language,
        session_id: sessionId,
        times_asked: 1,
        status: 'pending',
        assigned_to: 'unassigned',
        timestamp: new Date().toISOString()
      }]);

    if (error) {
      console.error("Error logging unknown question to Supabase:", error);
    }
  }

  async checkAndIncrementUnknownQuestion(
    question: string
  ): Promise<{ isNew: boolean; docId?: string }> {
    try {
      const { data, error } = await this.getSupabase()
        .from('unknown_questions')
        .select('id, times_asked')
        .eq('question_lower', question.toLowerCase())
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const { error: updateError } = await this.getSupabase()
          .from('unknown_questions')
          .update({
            times_asked: (data.times_asked || 0) + 1,
            last_asked: new Date().toISOString()
          })
          .eq('id', data.id);

        if (updateError) throw updateError;
        return { isNew: false, docId: data.id };
      }
      return { isNew: true };
    } catch (error) {
      console.error("Error checking unknown question in Supabase:", error);
      return { isNew: true };
    }
  }

  async getUnknownQuestions(
    filters?: {
      status?: string;
      assignedTo?: string;
      limit?: number;
    }
  ): Promise<UnknownQuestion[]> {
    try {
      let queryObj = this.getSupabase().from('unknown_questions').select('*').order('timestamp', { ascending: false });

      if (filters?.status) queryObj = queryObj.eq('status', filters.status);
      if (filters?.assignedTo) queryObj = queryObj.eq('assigned_to', filters.assignedTo);
      if (filters?.limit) queryObj = queryObj.limit(filters.limit);

      const { data, error } = await queryObj;
      if (error) throw error;

      return data.map((doc: any) => ({
        id: doc.id,
        question: doc.question,
        questionLower: doc.question_lower,
        detectedIntent: doc.detected_intent,
        confidence: doc.confidence,
        language: doc.language,
        timestamp: doc.timestamp ? new Date(doc.timestamp) : new Date(),
        sessionId: doc.session_id,
        timesAsked: doc.times_asked,
        status: doc.status,
        assignedTo: doc.assigned_to,
        lastAsked: doc.last_asked ? new Date(doc.last_asked) : undefined,
        reviewedBy: doc.reviewed_by,
        reviewedAt: doc.reviewed_at ? new Date(doc.reviewed_at) : undefined,
        response: doc.response,
        addedToKnowledgeArticleId: doc.added_to_knowledge_article_id,
        notes: doc.notes
      })) as UnknownQuestion[];
    } catch (error) {
      console.error("Supabase Error getting unknown questions:", error);
      return [];
    }
  }

  async updateUnknownQuestion(
    questionId: string,
    updates: Partial<{
      status: "pending" | "in_review" | "resolved" | "added_to_knowledge";
      assignedTo: string;
      reviewedBy: string;
      response: string;
      addedToKnowledgeArticleId: string;
      notes: string;
    }>
  ): Promise<void> {
    const updateData: any = {};

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo;
    if (updates.reviewedBy !== undefined) updateData.reviewed_by = updates.reviewedBy;
    if (updates.response !== undefined) updateData.response = updates.response;
    if (updates.addedToKnowledgeArticleId !== undefined) updateData.added_to_knowledge_article_id = updates.addedToKnowledgeArticleId;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    if (updates.reviewedBy || updates.status === "in_review" || updates.status === "resolved") {
      updateData.reviewed_at = new Date().toISOString();
    }

    const { error } = await this.getSupabase()
      .from('unknown_questions')
      .update(updateData)
      .eq('id', questionId);

    if (error) throw error;
  }

  async deleteUnknownQuestion(questionId: string): Promise<void> {
    const { error } = await this.getSupabase()
      .from('unknown_questions')
      .delete()
      .eq('id', questionId);

    if (error) throw error;
  }

  // ==================== DEFAULT PROMPT ====================

  private getDefaultPrompt(): string {
    return `You are Raya AI, a helpful virtual assistant for Sri Raghavendra Swamy Matha, Yelahanka.

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
  }

  // ==================== UTILITY METHODS ====================

  async resetToDefaults(userId: string): Promise<void> {
    await this.createDefaultSettings(userId);
  }
}

// Export singleton instance
export const aiSettingsRepository = new AISettingsRepository();
