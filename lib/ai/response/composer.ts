import { Intent, RetrievalType } from "@/lib/ai/intent/types";
import { RetrievalResult } from "@/lib/ai/retrieval/registry";
import { aiSettingsService } from "@/lib/ai/ai-settings";
import { getResponseMetadata } from "@/lib/ai/generator";
import { TempleSettings, TempleEvent, TempleSeva, TempleAnnouncement, PanchangaData, DonationInfo, AaradhaneEvent, KnowledgeArticle } from "@/lib/ai/retrieval/types";

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
  debugInfo?: Record<string, unknown>;
}

export class ResponseComposer {
  /**
   * Compose the final response
   */
  async compose(input: ComposerInput): Promise<ComposerOutput> {
    const { intent, confidence, language, retrievalResult } = input;
    const settings = await aiSettingsService.getAISettings();
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
      // Basic formatting
      if (retrievalResult.data?.templeSettings) {
         content = this.formatTempleSettings(retrievalResult.data.templeSettings, intent, language);
      } else if (retrievalResult.data?.upcomingEvents && intent === Intent.UPCOMING_EVENTS) {
         content = this.formatEvents(retrievalResult.data.upcomingEvents, language);
      } else if (retrievalResult.data?.availableSevas && (intent === Intent.SPECIAL_SEVAS || intent === Intent.DAILY_POOJA || intent === Intent.SEVA_BOOKING)) {
         content = this.formatSevas(retrievalResult.data.availableSevas, language);
      } else if (retrievalResult.data?.currentAnnouncements && intent === Intent.ANNOUNCEMENTS) {
         content = this.formatAnnouncements(retrievalResult.data.currentAnnouncements, language);
      } else if (retrievalResult.data?.todayPanchanga && intent === Intent.PANCHANGA) {
         content = this.formatPanchanga(retrievalResult.data.todayPanchanga, language);
      } else if (retrievalResult.data?.donationInfo && (intent === Intent.DONATION || intent === Intent.DONATION_PURPOSE || intent === Intent.DONATION_80G)) {
         content = this.formatDonations(retrievalResult.data.donationInfo, language);
      } else if (retrievalResult.data?.nextAaradhane && (intent === Intent.NEXT_AARADHANE || intent === Intent.FESTIVAL_INFO)) {
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

  private formatTempleSettings(settings: TempleSettings, intent: Intent, language: string) {
    if (intent === Intent.TEMPLE_TIMINGS) {
      return language === "en" ? `🕒 **Temple Timings**\n\nMorning: ${settings.timings.morningOpen} - ${settings.timings.morningClose}\nEvening: ${settings.timings.eveningOpen} - ${settings.timings.eveningClose}` : `🕒 **ದೇವಸ್ಥಾನದ ಸಮಯ**\n\nಬೆಳಗ್ಗೆ: ${settings.timings.morningOpen} - ${settings.timings.morningClose}\nಸಂಜೆ: ${settings.timings.eveningOpen} - ${settings.timings.eveningClose}`;
    }
    if (intent === Intent.CONTACT_INFORMATION) {
      return language === "en" ? `📞 **Contact Information**\n\nPhone: ${settings.phone}\nEmail: ${settings.email}` : `📞 **ಸಂಪರ್ಕ ಮಾಹಿತಿ**\n\nಫೋನ್: ${settings.phone}\nಇಮೇಲ್: ${settings.email}`;
    }
    if (intent === Intent.OFFICE_HOURS) {
      return language === "en" ? `🕒 **Office Hours**\n\nWeekday: ${settings.officeHours.weekday}\nWeekend: ${settings.officeHours.weekend}` : `🕒 **ಕಛೇರಿ ಸಮಯ**\n\nವಾರದ ದಿನಗಳು: ${settings.officeHours.weekday}\nವಾರಾಂತ್ಯ: ${settings.officeHours.weekend}`;
    }
    if (intent === Intent.VISITOR_GUIDELINES) {
      return language === "en" ? `🙏 **Visitor Guidelines**\n\n${settings.visitorInfo.guidelines}` : `🙏 **ಭೇಟಿ ಮಾರ್ಗಸೂಚಿಗಳು**\n\n${settings.visitorInfo.guidelines}`;
    }
    if (intent === Intent.DRESS_CODE) {
      return language === "en" ? `👕 **Dress Code**\n\n${settings.visitorInfo.dressCode}` : `👕 **ಉಡುಗೆ ನಿಯಮ**\n\n${settings.visitorInfo.dressCode}`;
    }
    if (intent === Intent.PHOTOGRAPHY) {
      return language === "en" ? `📸 **Photography Policy**\n\n${settings.visitorInfo.photographyPolicy}` : `📸 **ಛಾಯಾಗ್ರಹಣ ನಿಯಮ**\n\n${settings.visitorInfo.photographyPolicy}`;
    }
    if (intent === Intent.PARKING) {
      return language === "en" ? `🚗 **Parking**\n\n${settings.visitorInfo.parking}` : `🚗 **ಪಾರ್ಕಿಂಗ್**\n\n${settings.visitorInfo.parking}`;
    }
    return language === "en" ? `📍 **Location**\n\n${settings.address}` : `📍 **ಸ್ಥಳ**\n\n${settings.address}`;
  }

  private formatEvents(events: TempleEvent[], language: string) {
    if (!events || events.length === 0) return language === "en" ? "No upcoming events." : "ಯಾವುದೇ ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳಿಲ್ಲ.";
    let res = language === "en" ? "📅 **Upcoming Events**\n\n" : "📅 **ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು**\n\n";
    events.forEach(e => res += `- ${e.title}\n`);
    return res;
  }

  private formatSevas(sevas: TempleSeva[], language: string) {
     if (!sevas || sevas.length === 0) return language === "en" ? "No sevas found." : "ಯಾವುದೇ ಸೇವೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.";
     let res = language === "en" ? "🙏 **Available Sevas**\n\n" : "🙏 **ಲಭ್ಯವಿರುವ ಸೇವೆಗಳು**\n\n";
     sevas.slice(0, 5).forEach(s => res += `- ${s.name} (₹${s.amount})\n`);
     return res;
  }

  private formatAnnouncements(announcements: TempleAnnouncement[], language: string) {
     if (!announcements || announcements.length === 0) return language === "en" ? "No announcements." : "ಯಾವುದೇ ಘೋಷಣೆಗಳಿಲ್ಲ.";
     let res = language === "en" ? "📢 **Announcements**\n\n" : "📢 **ಘೋಷಣೆಗಳು**\n\n";
     announcements.forEach(a => res += `- ${a.title}\n`);
     return res;
  }

  private formatPanchanga(panchanga: PanchangaData, language: string) {
     if (!panchanga) return language === "en" ? "Panchanga data unavailable." : "ಪಂಚಾಂಗ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.";
     return language === "en" ? `📿 **Today's Panchanga**\n\nTithi: ${panchanga.tithi}\nNakshatra: ${panchanga.nakshatra}` : `📿 **ಇಂದಿನ ಪಂಚಾಂಗ**\n\nತಿಥಿ: ${panchanga.tithi}\nನಕ್ಷತ್ರ: ${panchanga.nakshatra}`;
  }

  private formatDonations(donation: DonationInfo, language: string) {
     if (!donation) return language === "en" ? "Donation information unavailable." : "ದೇಣಿಗೆ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.";
     return language === "en" ? `💝 **Donations**\n\nOnline donations accepted. Visit our website for details: ${donation.websiteUrl}` : `💝 **ದೇಣಿಗೆ**\n\nಆನ್‌ಲೈನ್ ದೇಣಿಗೆಗಳನ್ನು ಸ್ವೀಕರಿಸಲಾಗುತ್ತದೆ. ವಿವರಗಳಿಗಾಗಿ ನಮ್ಮ ವೆಬ್‌ಸೈಟ್‌ಗೆ ಭೇಟಿ ನೀಡಿ: ${donation.websiteUrl}`;
  }

  private formatAaradhane(aaradhane: AaradhaneEvent, language: string) {
     if (!aaradhane || !aaradhane.dates || aaradhane.dates.length === 0) return language === "en" ? "Next Aaradhane information unavailable." : "ಮುಂದಿನ ಆರಾಧನೆ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.";
     return language === "en" ? `🙏 **Next Aaradhane**\n\n${aaradhane.title} - ${aaradhane.dates[0]}` : `🙏 **ಮುಂದಿನ ಆರಾಧನೆ**\n\n${aaradhane.title} - ${aaradhane.dates[0]}`;
  }

  private formatKnowledge(article: KnowledgeArticle, language: string) {
    if (!article || !article.content) return language === "en" ? "Information unavailable." : "ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.";
    return article.content;
  }
}

export const responseComposer = new ResponseComposer();
