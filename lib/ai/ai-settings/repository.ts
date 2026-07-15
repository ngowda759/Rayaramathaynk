
// AI Settings Repository
// Handles Firebase operations for AI Management Center settings

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  AISettings,
  TempleInformation,
  VisitorInformation,
  TemplePolicies,
  AIResponses,
  AIBehaviorSettings,
  PromptSettings,
  IntentSettings,
  UnknownQuestion,
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

const AI_SETTINGS_COLLECTION = "ai_settings";
const UNKNOWN_QUESTIONS_COLLECTION = "unknown_questions";

export class AISettingsRepository {
  constructor() {
    // Repository uses the db from firebase
  }

  private getFirestore() {
    if (!db) {
      throw new Error("Firebase is not configured");
    }
    return db;
  }

  // ==================== AI SETTINGS ====================

  async getSettings(): Promise<AISettings | null> {
    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as AISettings;
    }

    return null;
  }

  async createDefaultSettings(userId: string): Promise<AISettings> {
    const settings: AISettings = {
      id: AI_SETTINGS_DOC_ID,
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

    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    await setDoc(docRef, {
      ...settings,
      updatedAt: Timestamp.fromDate(settings.updatedAt),
    });

    return settings;
  }

  async updateSettings(settings: Partial<AISettings>, userId: string): Promise<void> {
    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    await updateDoc(docRef, {
      ...settings,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  async updateTempleInformation(
    templeInformation: TempleInformation,
    userId: string
  ): Promise<void> {
    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    await updateDoc(docRef, {
      templeInformation,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  async updateVisitorInformation(
    visitorInformation: VisitorInformation,
    userId: string
  ): Promise<void> {
    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    await updateDoc(docRef, {
      visitorInformation,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  async updateTemplePolicies(
    templePolicies: TemplePolicies,
    userId: string
  ): Promise<void> {
    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    await updateDoc(docRef, {
      templePolicies,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  async updateAIResponses(aiResponses: AIResponses, userId: string): Promise<void> {
    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    await updateDoc(docRef, {
      aiResponses,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  async updateAIBehavior(aiBehavior: AIBehaviorSettings, userId: string): Promise<void> {
    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    await updateDoc(docRef, {
      aiBehavior,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  // ==================== PROMPT MANAGEMENT ====================

  async updatePromptSettings(promptSettings: PromptSettings, userId: string): Promise<void> {
    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    await updateDoc(docRef, {
      prompt: promptSettings,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  async createPromptVersion(
    content: string,
    userId: string,
    changeNotes?: string
  ): Promise<string> {
    const settings = await this.getSettings();
    if (!settings) {
      throw new Error("AI Settings not found");
    }

    const versions = settings.prompt.versions || [];
    const newVersionNumber = versions.length > 0 
      ? Math.max(...versions.map(v => v.version)) + 1 
      : 1;

    const newVersion = {
      id: `prompt_v${newVersionNumber}_${Date.now()}`,
      name: `Prompt v${newVersionNumber}`,
      version: newVersionNumber,
      content,
      status: "draft" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      changeNotes,
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

    // If publishing, set publishedAt
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
    const docRef = doc(this.getFirestore(), AI_SETTINGS_COLLECTION, AI_SETTINGS_DOC_ID);
    await updateDoc(docRef, {
      intents: intentSettings,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
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
      if (i.intentId === intentId) {
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
      if (i.intentId === intentId) {
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
    const docRef = doc(this.getFirestore(), UNKNOWN_QUESTIONS_COLLECTION, `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    
    const unknownQuestion: Omit<UnknownQuestion, "id"> = {
      question,
      questionLower: question.toLowerCase(),
      detectedIntent,
      confidence,
      language,
      timestamp: new Date(),
      sessionId,
      timesAsked: 1,
      status: "pending",
      assignedTo: "unassigned",
    };

    await setDoc(docRef, {
      ...unknownQuestion,
      timestamp: Timestamp.fromDate(unknownQuestion.timestamp),
    });
  }

  async checkAndIncrementUnknownQuestion(
    question: string
  ): Promise<{ isNew: boolean; docId?: string }> {
    const questionsRef = collection(this.getFirestore(), UNKNOWN_QUESTIONS_COLLECTION);
    const q = query(
      questionsRef,
      where("questionLower", "==", question.toLowerCase()),
      orderBy("timestamp", "desc"),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      await updateDoc(doc(this.getFirestore(), UNKNOWN_QUESTIONS_COLLECTION, docId), {
        timesAsked: increment(1),
      });
      return { isNew: false, docId };
    }

    return { isNew: true };
  }

  async getUnknownQuestions(
    filters?: {
      status?: string;
      assignedTo?: string;
      limit?: number;
    }
  ): Promise<UnknownQuestion[]> {
    try {
      const q = collection(this.getFirestore(), UNKNOWN_QUESTIONS_COLLECTION);

      // Apply filters - build constraints array
      const orderConstraint = orderBy("timestamp", "desc");
      const snapshot = filters?.limit
        ? await getDocs(query(q, orderConstraint, limit(filters.limit)))
        : await getDocs(query(q, orderConstraint));

      let questions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as UnknownQuestion[];

      // Apply additional filters in memory
      if (filters?.status) {
        questions = questions.filter((q) => q.status === filters.status);
      }
      if (filters?.assignedTo) {
        questions = questions.filter((q) => q.assignedTo === filters.assignedTo);
      }

      return questions;
    } catch (error) {
      // Return empty array when Firebase is not configured
      console.warn("Firebase not configured, returning empty unknown questions list");
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
    const docRef = doc(this.getFirestore(), UNKNOWN_QUESTIONS_COLLECTION, questionId);
    const updateData: Record<string, unknown> = { ...updates };

    if (updates.reviewedBy || updates.status === "in_review") {
      updateData.reviewedAt = Timestamp.now();
    }

    await updateDoc(docRef, updateData as Record<string, import("firebase/firestore").FieldValue | Partial<unknown>>);
  }

  async deleteUnknownQuestion(questionId: string): Promise<void> {
    const docRef = doc(this.getFirestore(), UNKNOWN_QUESTIONS_COLLECTION, questionId);
    await deleteDoc(docRef);
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
