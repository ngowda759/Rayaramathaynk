import { Intent, RetrievalType } from "@/lib/ai/intent/types";
import { RetrievalResult } from "@/lib/ai/retrieval/registry";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { getResponseMetadata } from "@/lib/ai/generator";

export interface ComposerInput {
  intent: Intent;
  confidence: number;
  language: "en" | "kn" | "mixed";
  retrievalResult: RetrievalResult;
}

export interface ComposerOutput {
  content: string;
  intent: Intent;
  confidence: number;
  source: RetrievalType;
  usesLLM: boolean;
  language: "en" | "kn" | "mixed";
  debugInfo?: any;
}

export class ResponseComposer {
  /**
   * Compose the final response
   */
  async compose(input: ComposerInput): Promise<ComposerOutput> {
    const { intent, confidence, language, retrievalResult } = input;
    const settings = await aiSettingsService.getAISettings();
    const safety = settings.safety;
    const behavior = settings.extendedBehavior;

    const meetsThreshold = confidence >= behavior.confidenceThreshold * 100;

    let content = "";
    let usesLLM = false;
    let finalSource = retrievalResult.source;

    if (!meetsThreshold) {
       // Fallback
       content = settings.aiResponses.unknownQuestion;
       finalSource = RetrievalType.FALLBACK;
    } else {
      // Basic formatting (this replaces the hardcoded logic in generator.ts)
      if (retrievalResult.data?.templeSettings) {
         content = this.formatTempleSettings(retrievalResult.data.templeSettings, intent, language);
      } else if (retrievalResult.data?.upcomingEvents) {
         content = this.formatEvents(retrievalResult.data.upcomingEvents, language);
      } else if (retrievalResult.data?.availableSevas) {
         content = this.formatSevas(retrievalResult.data.availableSevas, language);
      } else if (retrievalResult.data?.currentAnnouncements) {
         content = this.formatAnnouncements(retrievalResult.data.currentAnnouncements, language);
      } else if (retrievalResult.data?.todayPanchanga) {
         content = this.formatPanchanga(retrievalResult.data.todayPanchanga, language);
      } else if (retrievalResult.data?.donationInfo) {
         content = this.formatDonations(retrievalResult.data.donationInfo, language);
      } else if (retrievalResult.data?.nextAaradhane) {
         content = this.formatAaradhane(retrievalResult.data.nextAaradhane, language);
      } else if (retrievalResult.knowledgeArticles?.length && retrievalResult.knowledgeArticles.length > 0) {
         content = this.formatKnowledge(retrievalResult.knowledgeArticles[0], language);
      } else {
         content = settings.aiResponses.unknownQuestion;
         finalSource = RetrievalType.FALLBACK;
      }
    }

    return {
      content,
      intent,
      confidence,
      source: finalSource,
      usesLLM,
      language
    };
  }

  // Basic formatters to decouple from generator.ts
  private formatTempleSettings(settings: any, intent: Intent, language: string) {
    if (intent === Intent.TEMPLE_TIMINGS) {
      return language === "en" ? `🕒 **Temple Timings**\n\nMorning: ${settings.timings.morning.open} - ${settings.timings.morning.close}\nEvening: ${settings.timings.evening.open} - ${settings.timings.evening.close}` : `🕒 **ದೇವಸ್ಥಾನದ ಸಮಯ**\n\nಬೆಳಗ್ಗೆ: ${settings.timings.morning.open} - ${settings.timings.morning.close}\nಸಂಜೆ: ${settings.timings.evening.open} - ${settings.timings.evening.close}`;
    }
    if (intent === Intent.CONTACT_INFORMATION) {
      return language === "en" ? `📞 **Contact Information**\n\nPhone: ${settings.phone}\nEmail: ${settings.email}` : `📞 **ಸಂಪರ್ಕ ಮಾಹಿತಿ**\n\nಫೋನ್: ${settings.phone}\nಇಮೇಲ್: ${settings.email}`;
    }
    return language === "en" ? `📍 **Location**\n\n${settings.address}` : `📍 **ಸ್ಥಳ**\n\n${settings.address}`;
  }

  private formatEvents(events: any[], language: string) {
    if (!events || events.length === 0) return language === "en" ? "No upcoming events." : "ಯಾವುದೇ ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳಿಲ್ಲ.";
    let res = language === "en" ? "📅 **Upcoming Events**\n\n" : "📅 **ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು**\n\n";
    events.forEach(e => res += `- ${e.title}\n`);
    return res;
  }

  private formatSevas(sevas: any[], language: string) {
     if (!sevas || sevas.length === 0) return language === "en" ? "No sevas found." : "ಯಾವುದೇ ಸೇವೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.";
     let res = language === "en" ? "🙏 **Available Sevas**\n\n" : "🙏 **ಲಭ್ಯವಿರುವ ಸೇವೆಗಳು**\n\n";
     sevas.slice(0, 5).forEach(s => res += `- ${s.name} (₹${s.amount})\n`);
     return res;
  }

  private formatAnnouncements(announcements: any[], language: string) {
     if (!announcements || announcements.length === 0) return language === "en" ? "No announcements." : "ಯಾವುದೇ ಘೋಷಣೆಗಳಿಲ್ಲ.";
     let res = language === "en" ? "📢 **Announcements**\n\n" : "📢 **ಘೋಷಣೆಗಳು**\n\n";
     announcements.forEach(a => res += `- ${a.title}\n`);
     return res;
  }

  private formatPanchanga(panchanga: any, language: string) {
     return language === "en" ? `📿 **Today's Panchanga**\n\nTithi: ${panchanga.tithi}\nNakshatra: ${panchanga.nakshatra}` : `📿 **ಇಂದಿನ ಪಂಚಾಂಗ**\n\nತಿಥಿ: ${panchanga.tithi}\nನಕ್ಷತ್ರ: ${panchanga.nakshatra}`;
  }

  private formatDonations(donation: any, language: string) {
     return language === "en" ? `💝 **Donations**\n\nBank: ${donation.bankDetails.bankName}\nAcc: ${donation.bankDetails.accountNumber}\nIFSC: ${donation.bankDetails.ifscCode}` : `💝 **ದೇಣಿಗೆ**\n\nಬ್ಯಾಂಕ್: ${donation.bankDetails.bankName}\nಖಾತೆ: ${donation.bankDetails.accountNumber}\nIFSC: ${donation.bankDetails.ifscCode}`;
  }

  private formatAaradhane(aaradhane: any, language: string) {
     return language === "en" ? `🙏 **Next Aaradhane**\n\n${aaradhane.title} - ${aaradhane.dates.main}` : `🙏 **ಮುಂದಿನ ಆರಾಧನೆ**\n\n${aaradhane.title} - ${aaradhane.dates.main}`;
  }

  private formatKnowledge(article: any, language: string) {
    return article.content;
  }
}

export const responseComposer = new ResponseComposer();
