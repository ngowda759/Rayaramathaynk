/**
 * Admin Firestore Repository for AI Settings
 * Uses @google-cloud/firestore to bypass security rules in server-side operations
 */

import { getAdminFirestore } from "@/lib/admin-firebase";
import {
  AISettings,
  TempleInformation,
  VisitorInformation,
  TemplePolicies,
  AIResponses,
  AIBehaviorSettings,
  PromptSettings,
  IntentSettings,
  PromptVersion,
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

export class AIAdminRepository {
  private async getDocRef(docId: string = AI_SETTINGS_DOC_ID): Promise<any> {
    const db = await getAdminFirestore();
    // Enable ignoreUndefinedProperties to handle undefined values
    return db.collection(AI_SETTINGS_COLLECTION).doc(docId);
  }

  private async getDb(): Promise<any> {
    const db = await getAdminFirestore();
    return db;
  }

  async getSettings(): Promise<AISettings | null> {
    const docRef = await this.getDocRef();
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
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

    const docRef = await this.getDocRef();
    await docRef.set({
      ...settings,
      updatedAt: settings.updatedAt,
    });

    return settings;
  }

  async updatePromptSettings(promptSettings: PromptSettings, userId: string): Promise<void> {
    const docRef = await this.getDocRef();
    await docRef.update({
      prompt: promptSettings,
      updatedAt: new Date(),
      updatedBy: userId,
    });
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
      changeNotes: changeNotes || "", // Convert undefined to empty string
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
}

// Export singleton instance
export const aiAdminRepository = new AIAdminRepository();
