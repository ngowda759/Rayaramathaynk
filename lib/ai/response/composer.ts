/* eslint-disable */
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

/**
 * Fallback threshold (percent) when the configured value is missing/invalid.
 * Mirrors `DEFAULT_AI_BEHAVIOR_SETTINGS.confidenceThreshold` (0.85).
 */
const DEFAULT_CONFIDENCE_THRESHOLD_PERCENT = 85;

/**
 * Intents whose answer must come from repository data. These never render a
 * template with missing values, so a settings row holding an address but no
 * phone number falls back for a contact question instead of rendering "Phone: ".
 */
const FACTUAL_INTENTS = new Set<Intent>([
  Intent.TEMPLE_TIMINGS,
  Intent.CONTACT_INFORMATION,
  Intent.LOCATION,
  Intent.ADDRESS,
  Intent.OFFICE_HOURS,
  Intent.VISITOR_GUIDELINES,
  Intent.DRESS_CODE,
  Intent.PHOTOGRAPHY,
  Intent.PARKING,
  Intent.VOLUNTEER,
  Intent.UPCOMING_EVENTS,
  Intent.SPECIAL_SEVAS,
  Intent.DAILY_POOJA,
  Intent.SEVA_BOOKING,
  Intent.ANNOUNCEMENTS,
  Intent.PANCHANGA,
  Intent.DONATION,
  Intent.DONATION_PURPOSE,
  Intent.DONATION_80G,
  Intent.NEXT_AARADHANE,
  Intent.FESTIVAL_INFO,
]);

/**
 * The subset of factual intents answered from the temple settings document.
 * When the settings row exists but lacks the field for one of these intents,
 * there is no answer to give and the composer must fall back.
 */
const FACTUAL_SETTINGS_INTENTS = new Set<Intent>([
  Intent.TEMPLE_TIMINGS,
  Intent.CONTACT_INFORMATION,
  Intent.LOCATION,
  Intent.ADDRESS,
  Intent.OFFICE_HOURS,
  Intent.VISITOR_GUIDELINES,
  Intent.DRESS_CODE,
  Intent.PHOTOGRAPHY,
  Intent.PARKING,
  Intent.VOLUNTEER,
]);

export class ResponseComposer {
  /**
   * Compose the final response.
   *
   * Confidence gating is source-aware. An authoritative repository result (a
   * supported factual intent whose retrieval returned non-empty data) is
   * returned even when intent confidence is below `extendedBehavior.confidenceThreshold`.
   * Intent confidence scores the *classification*, and keyword/hybrid detection
   * legitimately lands in the 55-75 band; discarding real retrieved data on that
   * basis turned correct answers into "unknown" responses. Knowledge-base answers
   * and non-authoritative results still respect the numeric threshold, and the
   * generator's `requireSourceForFacts` check remains the factual grounding guard.
   */
  async compose(input: ComposerInput): Promise<ComposerOutput> {
    const { intent, confidence, language, retrievalResult } = input;
    const settings = await aiSettingsService.getAISettings();
    const behavior = settings.extendedBehavior;

    const threshold = this.resolveThreshold(behavior.confidenceThreshold);
    const meetsThreshold = confidence >= threshold;

    // Factual intents answer from repository data or not at all. Passing the
    // confidence bar is not evidence that the field exists.
    const hasGroundedData = this.hasGroundedData(intent, retrievalResult);

    let content = "";
    let usesLLM = false;
    let finalSource = retrievalResult.source;

    // Two independent reasons to fall back:
    //  - a factual intent whose specific field is absent (a partial settings row
    //    is not an answer), or
    //  - a low-confidence classification with no grounded repository data.
    // Grounded data still bypasses the numeric threshold, because intent
    // confidence scores the classification, not the retrieved facts.
    const shouldFallback = !hasGroundedData && (!meetsThreshold || FACTUAL_INTENTS.has(intent));

    if (shouldFallback) {
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

  /**
   * The configured threshold is a 0-1 ratio (`0.85`); intent confidence is a
   * 0-100 percentage. Convert to percent. A legacy percentage value (> 1) is
   * treated as already being on the percent scale so a stale row cannot demand
   * an impossible confidence.
   */
  private resolveThreshold(configured: number | undefined): number {
    if (typeof configured !== "number" || !Number.isFinite(configured) || configured <= 0) {
      return DEFAULT_CONFIDENCE_THRESHOLD_PERCENT;
    }
    return configured > 1 ? configured : configured * 100;
  }

  /**
   * True when retrieval produced usable data for this intent. For settings-backed
   * intents this checks the *specific* field the intent answers from, because a
   * partially-populated row is not an answer.
   */
  private hasGroundedData(intent: Intent, retrievalResult: RetrievalResult): boolean {
    if (retrievalResult.source === RetrievalType.FALLBACK) {
      return false;
    }

    const data = retrievalResult.data ?? {};
    const settings = data.templeSettings;

    if (settings) {
      if (this.hasSettingsFieldForIntent(intent, settings)) {
        return true;
      }
      // A settings row that does not answer this intent may still leave other
      // data below (events, sevas, ...), so fall through rather than returning.
      if (FACTUAL_SETTINGS_INTENTS.has(intent)) {
        return false;
      }
    }

    if (intent === Intent.UPCOMING_EVENTS) {
      return Array.isArray(data.upcomingEvents) && data.upcomingEvents.length > 0;
    }
    if ([Intent.SPECIAL_SEVAS, Intent.DAILY_POOJA, Intent.SEVA_BOOKING].includes(intent)) {
      return Array.isArray(data.availableSevas) && data.availableSevas.length > 0;
    }
    if (intent === Intent.ANNOUNCEMENTS) {
      return Array.isArray(data.currentAnnouncements) && data.currentAnnouncements.length > 0;
    }
    if (intent === Intent.PANCHANGA) {
      return Boolean(data.todayPanchanga);
    }
    if ([Intent.DONATION, Intent.DONATION_PURPOSE, Intent.DONATION_80G].includes(intent)) {
      return Boolean(data.donationInfo);
    }
    if ([Intent.NEXT_AARADHANE, Intent.FESTIVAL_INFO].includes(intent)) {
      return Boolean(data.nextAaradhane);
    }

    // Non-settings intents: any non-empty payload counts, except a settings row.
    // `formatTempleSettings` falls through to the address for unrecognised
    // intents, so a settings row alone must not ground an unrelated question.
    return Object.keys(data).some((key) => key !== "templeSettings");
  }

  /**
   * True when the settings document actually holds the field this intent answers
   * from. Keeps a partially-populated row from producing an authoritative reply
   * with blank values.
   */
  private hasSettingsFieldForIntent(intent: Intent, settings: TempleSettings): boolean {
    const filled = (value: string | undefined) => Boolean((value ?? "").trim());

    switch (intent) {
      case Intent.TEMPLE_TIMINGS:
        return filled(settings.timings?.morningOpen) || filled(settings.timings?.eveningOpen);
      case Intent.CONTACT_INFORMATION:
        return filled(settings.phone) || filled(settings.email) || filled(settings.contact?.phone);
      case Intent.LOCATION:
      case Intent.ADDRESS:
        return filled(settings.address) || filled(settings.contact?.address);
      case Intent.OFFICE_HOURS:
        return filled(settings.officeHours?.weekday) || filled(settings.officeHours?.weekend);
      case Intent.VOLUNTEER:
        return filled(settings.visitorInfo?.volunteerInfo);
      case Intent.VISITOR_GUIDELINES:
        return filled(settings.visitorInfo?.guidelines);
      case Intent.DRESS_CODE:
        return filled(settings.visitorInfo?.dressCode);
      case Intent.PHOTOGRAPHY:
        return filled(settings.visitorInfo?.photographyPolicy);
      case Intent.PARKING:
        return filled(settings.visitorInfo?.parking);
      default:
        return false;
    }
  }

  private formatTempleSettings(settings: TempleSettings, intent: Intent, language: string) {
    if (intent === Intent.TEMPLE_TIMINGS) {
      return language === "en" ? `🕒 **Temple Timings**\n\nMorning: ${settings.timings.morningOpen} - ${settings.timings.morningClose}\nEvening: ${settings.timings.eveningOpen} - ${settings.timings.eveningClose}` : `🕒 **ದೇವಸ್ಥಾನದ ಸಮಯ**\n\nಬೆಳಗ್ಗೆ: ${settings.timings.morningOpen} - ${settings.timings.morningClose}\nಸಂಜೆ: ${settings.timings.eveningOpen} - ${settings.timings.eveningClose}`;
    }
    if (intent === Intent.VOLUNTEER) {
      // Preserve the stored `volunteerInfo` text verbatim; never invent procedures.
      const info = settings.visitorInfo?.volunteerInfo?.trim() ?? "";
      if (language === "en") {
        return `🙏 **Volunteer at the Temple**\n\n${info}\n\nYou can also learn more and sign up on the volunteer page: /volunteer`;
      }
      return `🙏 **ದೇವಸ್ಥಾನದಲ್ಲಿ ಸ್ವಯಂಸೇವೆ**\n\n${info}\n\nಹೆಚ್ಚಿನ ಮಾಹಿತಿಗಾಗಿ ಮತ್ತು ನೋಂದಣಿಗಾಗಿ ಸ್ವಯಂಸೇವಕ ಪುಟವನ್ನು ನೋಡಿ: /volunteer`;
    }
    if (intent === Intent.CONTACT_INFORMATION) {
      const phone = (settings.phone || settings.contact?.phone || "").trim();
      const email = (settings.email || settings.contact?.email || "").trim();
      const contactLines = [
        phone ? (language === "en" ? `Phone: ${phone}` : `ಫೋನ್: ${phone}`) : "",
        email ? (language === "en" ? `Email: ${email}` : `ಇಮೇಲ್: ${email}`) : "",
      ].filter(Boolean);
      const title = language === "en" ? "📞 **Contact Information**" : "📞 **ಸಂಪರ್ಕ ಮಾಹಿತಿ**";
      return `${title}\n\n${contactLines.join("\n")}`;
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
    // Include the details the event rows already carry (date, time, venue) so the
    // answer is genuinely about the event rather than a bare list of titles.
    events.forEach(e => {
      const date = e.startDate instanceof Date && !Number.isNaN(e.startDate.getTime())
        ? e.startDate.toLocaleDateString(language === "en" ? "en-IN" : "kn-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "";
      const time = [e.startTime, e.endTime].filter(Boolean).join(" - ");
      const details = [date, time, e.location?.trim()].filter(Boolean).join(" | ");
      res += details ? `- **${e.title}** — ${details}\n` : `- **${e.title}**\n`;
    });
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
