import { createAdminClient } from "@/lib/supabase/admin";
import {
  AISettings,
  PromptSettings,
  PromptVersion,
  UnknownQuestion,
  UnknownQuestionStatus,
  AIGeneralSettings,
  AISafetySettings,
  AIExtendedBehaviorSettings,
  TempleInformation,
  VisitorInformation,
  TemplePolicies,
  AIResponses,
  AIBehaviorSettings,
  IntentSettings,
  DEFAULT_AI_GENERAL_SETTINGS,
  DEFAULT_AI_SAFETY_SETTINGS,
  DEFAULT_AI_EXTENDED_BEHAVIOR_SETTINGS,
  DEFAULT_TEMPLE_TIMINGS,
  DEFAULT_TEMPLE_CONTACT,
  DEFAULT_TEMPLE_OFFICE_HOURS,
  DEFAULT_VISITOR_INFORMATION,
  DEFAULT_TEMPLE_POLICIES,
  DEFAULT_AI_RESPONSES,
  DEFAULT_AI_BEHAVIOR_SETTINGS,
} from "@/types/ai-settings";

const AI_SETTINGS_DOC_ID = "main";
const AI_SETTINGS_COLLECTION = "ai_settings"; // Mapped to postgres table
const UNKNOWN_QUESTIONS_COLLECTION = "unknown_questions";

export class AIAdminRepository {
  private getSupabase() {
    return createAdminClient();
  }

  async getSettings(): Promise<AISettings | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from(AI_SETTINGS_COLLECTION)
      .select("*")
      .eq("id", AI_SETTINGS_DOC_ID)
      .maybeSingle();

    if (error) {
      console.error("Error fetching AI Settings from Supabase admin:", error);
      return null;
    }

    if (data) {
      return {
        id: data.id,
        general: data.general as AIGeneralSettings,
        safety: data.safety as AISafetySettings,
        extendedBehavior: data.extended_behavior as AIExtendedBehaviorSettings,
        templeInformation: data.temple_information as TempleInformation,
        visitorInformation: data.visitor_information as VisitorInformation,
        templePolicies: data.temple_policies as TemplePolicies,
        aiResponses: data.ai_responses as AIResponses,
        aiBehavior: data.ai_behavior as AIBehaviorSettings,
        prompt: data.prompt as PromptSettings,
        intents: data.intents as IntentSettings,
        updatedAt: new Date(data.updated_at),
        updatedBy: data.updated_by,
      };
    }

    return null;
  }

  async createDefaultSettings(userId: string): Promise<AISettings> {
    const settings: AISettings = {
      id: AI_SETTINGS_DOC_ID,
      general: DEFAULT_AI_GENERAL_SETTINGS,
      safety: DEFAULT_AI_SAFETY_SETTINGS,
      extendedBehavior: DEFAULT_AI_EXTENDED_BEHAVIOR_SETTINGS,
      templeInformation: {
        timings: DEFAULT_TEMPLE_TIMINGS,
        contact: DEFAULT_TEMPLE_CONTACT,
        officeHours: DEFAULT_TEMPLE_OFFICE_HOURS,
      },
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

    const supabase = this.getSupabase();
    const { error } = await supabase.from(AI_SETTINGS_COLLECTION).upsert({
      id: AI_SETTINGS_DOC_ID,
      general: settings.general,
      safety: settings.safety,
      extended_behavior: settings.extendedBehavior,
      temple_information: settings.templeInformation,
      visitor_information: settings.visitorInformation,
      temple_policies: settings.templePolicies,
      ai_responses: settings.aiResponses,
      ai_behavior: settings.aiBehavior,
      prompt: settings.prompt,
      intents: settings.intents,
      updated_by: userId,
    });

    if (error) {
      console.error("Error creating default settings:", error);
      throw error;
    }

    return settings;
  }

  async updatePromptSettings(promptSettings: PromptSettings, userId: string): Promise<void> {
    const supabase = this.getSupabase();
    await supabase
      .from(AI_SETTINGS_COLLECTION)
      .update({
        prompt: promptSettings,
        updated_by: userId,
      })
      .eq("id", AI_SETTINGS_DOC_ID);
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

    const newVersion: PromptVersion = {
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

    versions.push(newVersion);

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

  // ==================== UNKNOWN QUESTIONS (Admin) ====================

  async getUnknownQuestions(filters?: {
    status?: string;
    limit?: number;
  }): Promise<UnknownQuestion[]> {
    const supabase = this.getSupabase();
    let queryObj = supabase.from(UNKNOWN_QUESTIONS_COLLECTION).select('*').order('timestamp', { ascending: false });
    
    if (filters?.status) queryObj = queryObj.eq('status', filters.status);
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
  }

  async updateUnknownQuestion(
    questionId: string,
    updates: Partial<{
      status: UnknownQuestionStatus;
      assignedTo: string;
      reviewedBy: string;
      response: string;
      addedToKnowledgeArticleId: string;
      notes: string;
    }>
  ): Promise<void> {
    const supabase = this.getSupabase();
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

    const { error } = await supabase
      .from(UNKNOWN_QUESTIONS_COLLECTION)
      .update(updateData)
      .eq('id', questionId);

    if (error) throw error;
  }

  async deleteUnknownQuestion(questionId: string): Promise<void> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from(UNKNOWN_QUESTIONS_COLLECTION)
      .delete()
      .eq('id', questionId);

    if (error) throw error;
  }
}

// Export singleton instance
export const aiAdminRepository = new AIAdminRepository();
