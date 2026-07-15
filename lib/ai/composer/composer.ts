// Response Composer for Raya AI
// Handles building responses with confidence threshold and related articles

import { Intent, IntentDetectionResult } from "@/lib/ai/intent/types";
import { KnowledgeArticle } from "@/lib/ai/knowledge/types";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { searchArticles } from "@/lib/ai/knowledge/repository";

// Response structure
export interface ComposerResponse {
  text: string;
  intent: Intent;
  confidence: number;
  source: "repository" | "knowledge_base" | "fallback" | "ai_generated";
  relatedArticles?: KnowledgeArticle[];
  navigationButtons?: {
    text: string;
    route: string;
  }[];
  debugInfo?: {
    confidenceThreshold: number;
    matchedKeywords: string[];
    retrievalType: string;
  };
}

// Configuration
export interface ComposerConfig {
  confidenceThreshold?: number;
  maxRelatedArticles?: number;
  enableDebugMode?: boolean;
  enableStreaming?: boolean;
}

const DEFAULT_CONFIG: ComposerConfig = {
  confidenceThreshold: 85,
  maxRelatedArticles: 3,
  enableDebugMode: false,
  enableStreaming: false,
};

export class ResponseComposer {
  private config: ComposerConfig;

  constructor(config: Partial<ComposerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ComposerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Load configuration from AI Settings service
   */
  async loadConfigFromSettings(): Promise<void> {
    try {
      const behaviorSettings = await aiSettingsService.getAIBehavior();
      this.config = {
        confidenceThreshold: behaviorSettings.confidenceThreshold,
        maxRelatedArticles: behaviorSettings.maxRelatedArticles,
        enableDebugMode: behaviorSettings.debugMode,
        enableStreaming: behaviorSettings.streaming,
      };
    } catch (error) {
      console.warn("Failed to load config from settings, using defaults:", error);
    }
  }

  /**
   * Compose a response based on intent detection result
   */
  async compose(
    userMessage: string,
    intentResult: IntentDetectionResult,
    language: "en" | "kn" | "mixed" = "en"
  ): Promise<ComposerResponse> {
    const { intent, confidence, source: retrievalType, matchedKeywords } = intentResult;

    // Check if confidence meets threshold
    const meetsThreshold = confidence >= this.config.confidenceThreshold!;

    // Get repository data based on intent
    const repositoryData = await this.getRepositoryData(intent, language);

    // Get related articles from knowledge base
    const relatedArticles = await this.getRelatedArticles(
      userMessage,
      intent,
      this.config.maxRelatedArticles!
    );

    // Build the response
    let text: string;
    let responseSource: ComposerResponse["source"];

    if (repositoryData) {
      text = repositoryData;
      responseSource = "repository";
    } else if (relatedArticles.length > 0 && meetsThreshold) {
      text = this.buildKnowledgeResponse(relatedArticles[0]);
      responseSource = "knowledge_base";
    } else if (meetsThreshold) {
      // Generate response from AI
      text = await this.generateAIResponse(intent, language);
      responseSource = "ai_generated";
    } else {
      // Use fallback message
      text = await this.getFallbackMessage(language);
      responseSource = "fallback";

      // Log as unknown question
      await this.logUnknownQuestion(
        userMessage,
        intentResult.intent,
        confidence,
        language
      );
    }

    // Get navigation buttons if applicable
    const navigationButtons = this.getNavigationButtons(intent, language);

    // Build response
    const response: ComposerResponse = {
      text,
      intent,
      confidence,
      source: responseSource,
      relatedArticles: relatedArticles.slice(0, this.config.maxRelatedArticles),
      navigationButtons: navigationButtons.length > 0 ? navigationButtons : undefined,
    };

    // Add debug info if enabled
    if (this.config.enableDebugMode) {
      response.debugInfo = {
        confidenceThreshold: this.config.confidenceThreshold!,
        matchedKeywords,
        retrievalType,
      };
    }

    return response;
  }

  /**
   * Get structured data from repository based on intent
   */
  private async getRepositoryData(
    intent: Intent,
    language: "en" | "kn" | "mixed"
  ): Promise<string | null> {
    try {
      switch (intent) {
        case Intent.TEMPLE_TIMINGS:
          return this.formatTempleTimings(language);

        case Intent.CONTACT_INFORMATION:
          return this.formatContactInfo(language);

        case Intent.LOCATION:
        case Intent.ADDRESS:
          return this.formatLocation(language);

        case Intent.OFFICE_HOURS:
          return this.formatOfficeHours(language);

        case Intent.PARKING:
          return this.formatParking(language);

        case Intent.DRESS_CODE:
          return this.formatDressCode(language);

        case Intent.PHOTOGRAPHY:
          return this.formatPhotographyPolicy(language);

        case Intent.VISITOR_GUIDELINES:
          return this.formatVisitorGuidelines(language);

        case Intent.DONATION:
        case Intent.DONATION_80G:
        case Intent.DONATION_PURPOSE:
          return this.formatDonationInfo(language);

        case Intent.ANNADANA:
          return this.formatAnnadanam(language);

        case Intent.PRASADA:
          return this.formatPrasada(language);

        case Intent.SEVA_BOOKING:
        case Intent.BOOKING:
          return this.formatSevaBooking(language);

        default:
          return null;
      }
    } catch (error) {
      console.error("Error getting repository data:", error);
      return null;
    }
  }

  /**
   * Get related articles from knowledge base
   */
  private async getRelatedArticles(
    userMessage: string,
    intent: Intent,
    maxArticles: number
  ): Promise<KnowledgeArticle[]> {
    try {
      const searchResults = await searchArticles(userMessage, 5);
      const articles = searchResults.map((r) => r.article);
      return articles.slice(0, maxArticles);
    } catch (error) {
      console.error("Error getting related articles:", error);
      return [];
    }
  }

  /**
   * Build response from knowledge article
   */
  private buildKnowledgeResponse(article: KnowledgeArticle): string {
    // Knowledge articles have a single content string
    // The language field indicates the primary language
    return article.content;
  }

  /**
   * Generate AI response (placeholder - would integrate with LLM)
   */
  private async generateAIResponse(
    intent: Intent,
    language: "en" | "kn" | "mixed"
  ): Promise<string> {
    // Get AI response template if available
    try {
      const template = await aiSettingsService.getLocalizedResponse("fallback", language);
      if (template) {
        return template;
      }
    } catch {
      // Fall back to default
    }

    // Default AI-generated responses
    const defaultResponses: Partial<Record<Intent, Record<string, string>>> = {
      [Intent.TEMPLE_HISTORY]: {
        en: "Sri Raghavendra Swamy Matha has a rich history spanning several centuries. The temple is dedicated to Sri Raghavendra Swamy, a renowned saint and philosopher of the Madhwa tradition.",
        kn: "ಶ್ರೀ ರಾಗವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠವು ಹಲವಾರು ಶತಮಾನಗಳನ್ನು ವಿಸ್ತರಿಸಿದ ಶ್ರೀಮಂತ ಇತಿಹಾಸವನ್ನು ಹೊಂದಿದೆ.",
      },
      [Intent.FAQ]: {
        en: "For common questions about the temple, please refer to our FAQ section or contact the temple office for specific inquiries.",
        kn: "ದೇವಸ್ಥಾನದ ಬಗ್ಗೆ ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆಗಳಿಗೆ, ದಯವಿಟ್ಟು ನಮ್ಮ FAQ ವಿಭಾಗವನ್ನು ನೋಡಿ.",
      },
    };

    const responses = defaultResponses[intent];
    if (responses) {
      return responses[language] || responses.en;
    }

    return language === "kn"
      ? "ದಯವಿಟ್ಟು ಇನ್ನಷ್ಟು ಮಾಹಿತಿಗೆ ದೇವಸ್ಥಾನ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ."
      : "Please contact the temple office for more information.";
  }

  /**
   * Get fallback message
   */
  private async getFallbackMessage(language: "en" | "kn" | "mixed"): Promise<string> {
    try {
      const template = await aiSettingsService.getLocalizedResponse(
        "unknownQuestion",
        language
      );
      if (template) {
        return template;
      }
    } catch {
      // Fall back to default
    }

    return language === "kn"
      ? "ಕ್ಷಮಿಸಿ, ಈ ಪ್ರಶ್ನೆಗೆ ನನ್ನಲ್ಲಿ ಉತ್ತರವಿಲ್ಲ. ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ: +91-80-28446400"
      : "I couldn't find a verified answer to your question. Please contact the temple office for confirmation: +91-80-28446400";
  }

  /**
   * Log unknown question
   */
  private async logUnknownQuestion(
    question: string,
    intent: Intent,
    confidence: number,
    language: "en" | "kn" | "mixed"
  ): Promise<void> {
    try {
      await aiSettingsService.logUnknownQuestion(
        question,
        intent,
        confidence,
        language,
        "chat_session"
      );
    } catch (error) {
      console.error("Failed to log unknown question:", error);
    }
  }

  /**
   * Get navigation buttons for certain intents
   */
  private getNavigationButtons(
    intent: Intent,
    language: "en" | "kn" | "mixed"
  ): { text: string; route: string }[] {
    const buttons: Partial<Record<Intent, { text: string; route: string }[]>> = {
      [Intent.SHARE_EXPERIENCE]: [
        { text: language === "kn" ? "ನಿಮ್ಮ ಅನುಭವ ಹಂಚಿಕೊಳ್ಳಿ" : "Share Your Experience", route: "/testimonials" },
      ],
      [Intent.PARKING]: [
        { text: language === "kn" ? "ಪಾರ್ಕಿಂಗ್ ಮಾಹಿತಿ" : "View Parking Info", route: "/visit" },
      ],
      [Intent.DRESS_CODE]: [
        { text: language === "kn" ? "ಉಡುಗೆ ನಿಯಮ" : "View Dress Code", route: "/guidelines" },
      ],
      [Intent.PHOTOGRAPHY]: [
        { text: language === "kn" ? "ಛಾಯಾಗ್ರಹಣ ಮಾರ್ಗಸೂಚನೆಗಳು" : "Photography Guidelines", route: "/guidelines" },
      ],
      [Intent.VOLUNTEER]: [
        { text: language === "kn" ? "ಸ್ವಯಂಸೇವಕರಾಗಿ ಸೇರಿ" : "Become a Volunteer", route: "/volunteer" },
      ],
      [Intent.DONATION]: [
        { text: language === "kn" ? "ದೇಣ ನೀಡಿ" : "Make a Donation", route: "/donate" },
      ],
      [Intent.SEVA_BOOKING]: [
        { text: language === "kn" ? "ಸೇವೆ ಕಾಯ್ದಿರಿಸಿ" : "Book a Seva", route: "/book" },
      ],
      [Intent.CONTACT_REQUEST]: [
        { text: language === "kn" ? "ಸಂಪರ್ಕಿಸಿ" : "Contact Us", route: "/contact" },
      ],
    };

    return buttons[intent] || [];
  }

  // ==================== FORMAT HELPERS ====================

  private async formatTempleTimings(language: "en" | "kn" | "mixed"): Promise<string> {
    const templeInfo = await aiSettingsService.getTempleInformation();
    const { timings } = templeInfo;

    if (language === "kn") {
      return `ದೇವಸ್ಥಾನದ ಸಮಯ:
ಬೆಳಗಿನ ತೆರೆಯುವಿಕೆ: ${timings.morningOpen}
ಬೆಳಗಿನ ಮುಚ್ಚುವಿಕೆ: ${timings.morningClose}
ಸಂಜೆ ತೆರೆಯುವಿಕೆ: ${timings.eveningOpen}
ಸಂಜೆ ಮುಚ್ಚುವಿಕೆ: ${timings.eveningClose}
${timings.specialNotes ? `ವಿಶೇಷ ಸೂಚನೆ: ${timings.specialNotes}` : ""}`;
    }

    return `Temple Timings:
Morning: ${timings.morningOpen} - ${timings.morningClose}
Evening: ${timings.eveningOpen} - ${timings.eveningClose}
${timings.specialNotes ? `\nNote: ${timings.specialNotes}` : ""}`;
  }

  private async formatContactInfo(language: "en" | "kn" | "mixed"): Promise<string> {
    const templeInfo = await aiSettingsService.getTempleInformation();
    const { contact } = templeInfo;

    if (language === "kn") {
      return `ದೇವಸ್ಥಾನ ಸಂಪರ್ಕ:
ಫೋನ್: ${contact.phone}
ಇಮೇಲ್: ${contact.email}
ವಿಳಾಸ: ${contact.address}`;
    }

    return `Temple Contact:
Phone: ${contact.phone}
Email: ${contact.email}
Address: ${contact.address}`;
  }

  private async formatLocation(language: "en" | "kn" | "mixed"): Promise<string> {
    const templeInfo = await aiSettingsService.getTempleInformation();
    const { contact } = templeInfo;

    if (language === "kn") {
      return `ದೇವಸ್ಥಾನದ ಸ್ಥಳ:
ವಿಳಾಸ: ${contact.address}
${contact.googleMapsUrl ? `Google Maps: ${contact.googleMapsUrl}` : ""}`;
    }

    return `Temple Location:
Address: ${contact.address}
${contact.googleMapsUrl ? `Google Maps: ${contact.googleMapsUrl}` : ""}`;
  }

  private async formatOfficeHours(language: "en" | "kn" | "mixed"): Promise<string> {
    const templeInfo = await aiSettingsService.getTempleInformation();
    const { officeHours } = templeInfo;

    if (language === "kn") {
      return `ಕಛೇರಿ ಸಮಯ:
ಕೆಲಸದ ದಿನಗಳು: ${officeHours.weekday}
ವಾರಾಂತ್ಯ: ${officeHours.weekend}`;
    }

    return `Office Hours:
Weekdays: ${officeHours.weekday}
Weekend: ${officeHours.weekend}`;
  }

  private async formatParking(language: "en" | "kn" | "mixed"): Promise<string> {
    const visitorInfo = await aiSettingsService.getVisitorInformation();
    const { parking } = visitorInfo;

    if (language === "kn") {
      return `ಪಾರ್ಕಿಂಗ್ ಸೌಲಭ್ಯ: ${parking}`;
    }

    return `Parking Facilities: ${parking}`;
  }

  private async formatDressCode(language: "en" | "kn" | "mixed"): Promise<string> {
    const visitorInfo = await aiSettingsService.getVisitorInformation();
    const { dressCode } = visitorInfo;

    if (language === "kn") {
      return `ಉಡುಗೆ ನಿಯಮ: ${dressCode}`;
    }

    return `Dress Code: ${dressCode}`;
  }

  private async formatPhotographyPolicy(language: "en" | "kn" | "mixed"): Promise<string> {
    const visitorInfo = await aiSettingsService.getVisitorInformation();
    const { photographyPolicy } = visitorInfo;

    if (language === "kn") {
      return `ಛಾಯಾಗ್ರಹಣ ನಿಯಮ: ${photographyPolicy}`;
    }

    return `Photography Policy: ${photographyPolicy}`;
  }

  private async formatVisitorGuidelines(language: "en" | "kn" | "mixed"): Promise<string> {
    const visitorInfo = await aiSettingsService.getVisitorInformation();
    const { guidelines } = visitorInfo;

    if (language === "kn") {
      return `ಭೇಟಿದಾರರ ಮಾರ್ಗದರ್ಶನ: ${guidelines}`;
    }

    return `Visitor Guidelines: ${guidelines}`;
  }

  private async formatDonationInfo(language: "en" | "kn" | "mixed"): Promise<string> {
    const policies = await aiSettingsService.getTemplePolicies();
    const { donations, information80G } = policies;

    if (language === "kn") {
      let info = `ದೇಣ: ${donations}`;
      if (information80G) {
        info += `\n80G ತೆರಿಗೆ ರಿಯಾಯಿತಿ ಮಾಹಿತಿ: ${information80G}`;
      }
      return info;
    }

    let info = `Donations: ${donations}`;
    if (information80G) {
      info += `\n80G Tax Benefit Info: ${information80G}`;
    }
    return info;
  }

  private async formatAnnadanam(language: "en" | "kn" | "mixed"): Promise<string> {
    const visitorInfo = await aiSettingsService.getVisitorInformation();
    const { annadanam } = visitorInfo;

    if (language === "kn") {
      return `ಅನ್ನದಾನ: ${annadanam}`;
    }

    return `Annadanam (Free Meals): ${annadanam}`;
  }

  private async formatPrasada(language: "en" | "kn" | "mixed"): Promise<string> {
    const visitorInfo = await aiSettingsService.getVisitorInformation();
    const { prasada } = visitorInfo;

    if (language === "kn") {
      return `ಪ್ರಸಾದ: ${prasada}`;
    }

    return `Prasada (Sacred Food): ${prasada}`;
  }

  private async formatSevaBooking(language: "en" | "kn" | "mixed"): Promise<string> {
    const policies = await aiSettingsService.getTemplePolicies();
    const { sevaBooking } = policies;

    if (language === "kn") {
      return `ಸೇವೆ ಕಾಯ್ದಿರಿಸುವಿಕೆ: ${sevaBooking}`;
    }

    return `Seva Booking: ${sevaBooking}`;
  }
}

// Export singleton instance
export const responseComposer = new ResponseComposer();
