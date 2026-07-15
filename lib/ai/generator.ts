// Hybrid AI Response Generator
// Combines structured retrieval with LLM for accurate responses

import {
  Intent,
  IntentDetectionResult,
  RetrievalType,
  detectIntent,
} from "./intent";

import {
  getTempleSettings,
  getTempleTimings,
  getContactInfo,
  getUpcomingEvents,
  formatEventsListForDisplay,
  getActiveSevas,
  formatSevasListForDisplay,
  getActiveAnnouncements,
  formatAnnouncementsForDisplay,
  getTodayPanchanga,
  formatPanchangaSimple,
  getDonationInfo,
  formatDonationInfoForDisplay,
  format80GInfo,
  getNextAaradhane,
  formatAaradhaneForDisplay,
} from "./retrieval";

import {
  getKnowledgeContext,
  formatArticlesForContext,
  getGreetingResponse,
  getClosingResponse,
  getOutOfScopeResponse,
  getThankYouResponse,
} from "./knowledge";

import { containsKannada } from "./intent/patterns";

export { detectIntent } from "./intent";

/**
 * Response generation result with metadata
 */
export interface AIResponseResult {
  content: string;
  intent: Intent;
  confidence: number;
  source: RetrievalType;
  usesLLM: boolean;
  language: "en" | "kn" | "mixed";
}

/**
 * Detect language from message
 */
function detectLanguage(message: string): "en" | "kn" | "mixed" {
  const hasKannada = containsKannada(message);
  
  // Simple detection based on Kannada presence
  if (hasKannada) {
    // Check for mixed by looking for English words
    const englishPattern = /\b(the|is|are|what|when|how|where|temple|seva|donation)\b/gi;
    const englishMatches = message.match(englishPattern);
    
    if (englishMatches && englishMatches.length > 2) {
      return "mixed";
    }
    return "kn";
  }
  return "en";
}

/**
 * Generate response for temple timings intent
 */
async function handleTempleTimings(
  language: "en" | "kn" | "mixed"
): Promise<AIResponseResult> {
  const timings = await getTempleTimings();
  
  if (!timings.data) {
    return {
      content: "I apologize, I could not retrieve the temple timings at this moment. Please check the official website or contact the temple office.",
      intent: Intent.TEMPLE_TIMINGS,
      confidence: 0,
      source: RetrievalType.FALLBACK,
      usesLLM: false,
      language,
    };
  }

  const t = timings.data;
  const morningOpen = t.morning.open || "6:00 AM";
  const morningClose = t.morning.close || "12:00 PM";
  const eveningOpen = t.evening.open || "5:00 PM";
  const eveningClose = t.evening.close || "8:30 PM";

  let content = "";
  
  if (language === "en") {
    content = `🕐 **Temple Timings**

**Morning:** ${morningOpen} – ${morningClose}
**Evening:** ${eveningOpen} – ${eveningClose}

Note: Festival timings may vary. Please check the official website for special occasions.`;
  } else if (language === "kn") {
    content = `🕐 **ದೇವಸ್ಥಾನದ ಸಮಯ**

**ಬೆಳಗು:** ${morningOpen} – ${morningClose}
**ಸಂಜೆ:** ${eveningOpen} – ${eveningClose}

ಸೂಚನೆ: ಹಬ್ಬದ ಸಮಯಗಳು ಬದಲಾಗಬಹುದು. ವಿಶೇಷ ಸಂದರ್ಭಗಳಿಗೆ ಅಧಿಕೃತ ವೆಬ್‌ಸೈಟ್ ಅನ್ನು ಪರಿಶೀಲಿಸಿ.`;
  } else {
    content = `🕐 **Temple Timings / ದೇವಸ್ಥಾನದ ಸಮಯ**

**Morning / ಬೆಳಗು:** ${morningOpen} – ${morningClose}
**Evening / ಸಂಜೆ:** ${eveningOpen} – ${eveningClose}`;
  }

  return {
    content,
    intent: Intent.TEMPLE_TIMINGS,
    confidence: timings.confidence,
    source: timings.source,
    usesLLM: false,
    language,
  };
}

/**
 * Generate response for contact information intent
 */
async function handleContactInformation(
  language: "en" | "kn" | "mixed"
): Promise<AIResponseResult> {
  const contact = await getContactInfo();
  
  if (!contact.data) {
    return {
      content: "I apologize, I could not retrieve contact information at this moment.",
      intent: Intent.CONTACT_INFORMATION,
      confidence: 0,
      source: RetrievalType.FALLBACK,
      usesLLM: false,
      language,
    };
  }

  const c = contact.data;
  
  let content = "";
  
  if (language === "en") {
    content = `📞 **Contact Information**

**Phone:** ${c.phone || "Please contact temple office"}
**Email:** ${c.email || "Please contact temple office"}
**Address:** ${c.address || "Available on website"}`;
  } else if (language === "kn") {
    content = `📞 **ಸಂಪರ್ಕ ಮಾಹಿತಿ**

**ಫೋನ್:** ${c.phone || "ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ"}
**ಇಮೇಲ್:** ${c.email || "ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ"}
**ವಿಳಾಸ:** ${c.address || "ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಲಭ್ಯ"}`;
  } else {
    content = `📞 **Contact Info / ಸಂಪರ್ಕ ಮಾಹಿತಿ**

**Phone / ಫೋನ್:** ${c.phone}
**Email / ಇಮೇಲ್:** ${c.email}`;
  }

  return {
    content,
    intent: Intent.CONTACT_INFORMATION,
    confidence: contact.confidence,
    source: contact.source,
    usesLLM: false,
    language,
  };
}

/**
 * Generate response for location intent
 */
async function handleLocation(
  language: "en" | "kn" | "mixed"
): Promise<AIResponseResult> {
  const settings = await getTempleSettings();
  
  if (!settings.data) {
    return {
      content: "I apologize, I could not retrieve location information at this moment.",
      intent: Intent.LOCATION,
      confidence: 0,
      source: RetrievalType.FALLBACK,
      usesLLM: false,
      language,
    };
  }

  const s = settings.data;
  
  let content = "";
  
  if (language === "en") {
    content = `📍 **Temple Location**

**Sri Raghavendra Swamy Matha**
${s.address}

We are located in Yelahanka New Town, Bengaluru. The temple is easily accessible by road and public transportation.

For directions, search for "Sri Raghavendra Swamy Matha Yelahanka" on Google Maps.`;
  } else if (language === "kn") {
    content = `📍 **ದೇವಸ್ಥಾನದ ಸ್ಥಳ**

**ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ**
${s.address}

ನಾವು ಬೆಂಗಳೂರಿನ ಯಲಹಂಕ ನ್ಯೂ ಟೌನ್‌ನಲ್ಲಿದ್ದೇವೆ. Google Maps ನಲ್ಲಿ "Sri Raghavendra Swamy Matha Yelahanka" ಅನ್ನು ಹುಡುಕಿ.`;
  } else {
    content = `📍 **Location / ಸ್ಥಳ**

**Sri Raghavendra Swamy Matha**
${s.address}`;
  }

  return {
    content,
    intent: Intent.LOCATION,
    confidence: settings.confidence,
    source: settings.source,
    usesLLM: false,
    language,
  };
}

/**
 * Generate response for events intent
 */
async function handleEvents(
  language: "en" | "kn" | "mixed"
): Promise<AIResponseResult> {
  const events = await getUpcomingEvents(5);
  
  if (!events.data || events.data.length === 0) {
    return {
      content: language === "en" 
        ? "📅 There are no upcoming events scheduled at the moment. Please check back later or visit our website for updates."
        : language === "kn"
        ? "📅 ಪ್ರಸ್ತುತ ಯಾವುದೇ ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳಿಲ್ಲ. ದಯವಿಟ್ಟು ನಂತರ ಪರಿಶೀಲಿಸಿ."
        : "📅 No upcoming events / ಯಾವುದೇ ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳಿಲ್ಲ.",
      intent: Intent.UPCOMING_EVENTS,
      confidence: events.confidence,
      source: events.source,
      usesLLM: false,
      language,
    };
  }

  const formattedEvents = formatEventsListForDisplay(events.data);
  
  const suffix = language === "kn" 
    ? "\n\nಹೆಚ್ಚಿನ ಮಾಹಿತಿಗೆ ವೆಬ್‌ಸೈಟ್ ಅನ್ನು ಭೇಟಿ ಮಾಡಿ."
    : language === "mixed"
    ? "\n\nFor more info / ಹೆಚ್ಚಿನ ಮಾಹಿತಿಗೆ: Visit our website"
    : "\n\nFor more details, please visit our website.";

  return {
    content: formattedEvents + suffix,
    intent: Intent.UPCOMING_EVENTS,
    confidence: events.confidence,
    source: events.source,
    usesLLM: false,
    language,
  };
}

/**
 * Generate response for sevas intent
 */
async function handleSevas(
  language: "en" | "kn" | "mixed",
  originalIntent: Intent = Intent.SPECIAL_SEVAS
): Promise<AIResponseResult> {
  const sevas = await getActiveSevas();
  
  if (!sevas.data || sevas.data.length === 0) {
    return {
      content: language === "en" 
        ? "🙏 I apologize, I could not retrieve the list of sevas at this moment. Please visit the temple office for more information."
        : language === "kn"
        ? "🙏 ಪ್ರಸ್ತುತ ಸೇವೆಗಳ ಪಟ್ಟಿಯನ್ನು ಪಡೆಯಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ."
        : "🙏 ಸೇವೆಗಳ ಬಗ್ಗೆ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.",
      intent: originalIntent,
      confidence: sevas.confidence,
      source: sevas.source,
      usesLLM: false,
      language,
    };
  }

  const formattedSevas = formatSevasListForDisplay(sevas.data);
  
  const suffix = language === "en"
    ? "\n\nTo book a seva, please visit the temple office or use our online booking system."
    : language === "kn"
    ? "\n\nಸೇವೆಯನ್ನು ಕಾಯ್ದಿರಿಸಲು, ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ ಅಥವಾ ಆನ್‌ಲೈನ್ ಬುಕಿಂಗ್ ಬಳಸಿ."
    : "\n\nTo book / ಕಾಯ್ದಿರಿಸಲು: Visit temple office or website";

  return {
    content: formattedSevas + suffix,
    intent: originalIntent,
    confidence: sevas.confidence,
    source: sevas.source,
    usesLLM: false,
    language,
  };
}

/**
 * Generate response for announcements intent
 */
async function handleAnnouncements(
  language: "en" | "kn" | "mixed"
): Promise<AIResponseResult> {
  const announcements = await getActiveAnnouncements();
  
  if (!announcements.data || announcements.data.length === 0) {
    return {
      content: language === "en"
        ? "📢 There are no current announcements."
        : language === "kn"
        ? "📢 ಪ್ರಸ್ತುತ ಯಾವುದೇ ಘೋಷಣೆಗಳಿಲ್ಲ."
        : "📢 No current announcements / ಯಾವುದೇ ಘೋಷಣೆಗಳಿಲ್ಲ.",
      intent: Intent.ANNOUNCEMENTS,
      confidence: announcements.confidence,
      source: announcements.source,
      usesLLM: false,
      language,
    };
  }

  const formatted = formatAnnouncementsForDisplay(announcements.data);
  
  return {
    content: formatted,
    intent: Intent.ANNOUNCEMENTS,
    confidence: announcements.confidence,
    source: announcements.source,
    usesLLM: false,
    language,
  };
}

/**
 * Generate response for panchanga intent
 */
async function handlePanchanga(
  language: "en" | "kn" | "mixed"
): Promise<AIResponseResult> {
  const panchanga = await getTodayPanchanga();
  
  if (!panchanga.data) {
    return {
      content: language === "en"
        ? "📿 I apologize, I could not retrieve today's Panchanga at this moment."
        : language === "kn"
        ? "📿 ಇಂದಿನ ಪಂಚಾಂಗವನ್ನು ಪಡೆಯಲಾಗಲಿಲ್ಲ."
        : "📿 Panchanga not available / ಪಂಚಾಂಗ ಲಭ್ಯವಿಲ್ಲ.",
      intent: Intent.PANCHANGA,
      confidence: 0,
      source: RetrievalType.FALLBACK,
      usesLLM: false,
      language,
    };
  }

  const formatted = formatPanchangaSimple(panchanga.data);
  
  return {
    content: formatted,
    intent: Intent.PANCHANGA,
    confidence: panchanga.confidence,
    source: panchanga.source,
    usesLLM: false,
    language,
  };
}

/**
 * Generate response for donation intent
 */
async function handleDonation(
  language: "en" | "kn" | "mixed"
): Promise<AIResponseResult> {
  const donationInfo = await getDonationInfo();
  
  if (!donationInfo.data) {
    return {
      content: language === "en"
        ? "💝 I apologize, I could not retrieve donation information at this moment. Please visit the donations page on our website or contact the temple office."
        : language === "kn"
        ? "💝 ದಾನ ಮಾಹಿತಿಯನ್ನು ಪಡೆಯಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ವೆಬ್‌ಸೈಟ್‌ನ ದಾನ ಪುಟವನ್ನು ಭೇಟಿ ಮಾಡಿ."
        : "💝 ದಾನ info not available",
      intent: Intent.DONATION,
      confidence: 0,
      source: RetrievalType.FALLBACK,
      usesLLM: false,
      language,
    };
  }

  const formatted = formatDonationInfoForDisplay(donationInfo.data);
  
  return {
    content: formatted,
    intent: Intent.DONATION,
    confidence: donationInfo.confidence,
    source: donationInfo.source,
    usesLLM: false,
    language,
  };
}

/**
 * Generate response for aaradhane intent
 */
async function handleAaradhane(
  language: "en" | "kn" | "mixed"
): Promise<AIResponseResult> {
  const aaradhane = await getNextAaradhane();
  
  if (!aaradhane.data) {
    return {
      content: language === "en"
        ? "🙏 The next Aaradhane date information is not available at the moment. Please check our website or contact the temple office for details."
        : language === "kn"
        ? "🙏 ಮುಂದಿನ ಆರಾಧನೆಯ ದಿನಾಂಕದ ಮಾಹಿತಿ ಪ್ರಸ್ತುತ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ವೆಬ್‌ಸೈಟ್ ಅನ್ನು ಪರಿಶೀಲಿಸಿ."
        : "🙏 Aaradhane info not available",
      intent: Intent.NEXT_AARADHANE,
      confidence: 0,
      source: RetrievalType.FALLBACK,
      usesLLM: false,
      language,
    };
  }

  const formatted = formatAaradhaneForDisplay(aaradhane.data);
  
  return {
    content: formatted,
    intent: Intent.NEXT_AARADHANE,
    confidence: aaradhane.confidence,
    source: aaradhane.source,
    usesLLM: false,
    language,
  };
}

/**
 * Handle greeting intent
 */
function handleGreeting(language: "en" | "kn" | "mixed"): AIResponseResult {
  return {
    content: getGreetingResponse(language),
    intent: Intent.GENERAL_GREETING,
    confidence: 100,
    source: RetrievalType.KNOWLEDGE_BASE,
    usesLLM: false,
    language,
  };
}

/**
 * Handle thanks intent
 */
function handleThanks(language: "en" | "kn" | "mixed"): AIResponseResult {
  return {
    content: getThankYouResponse(language),
    intent: Intent.THANKS,
    confidence: 100,
    source: RetrievalType.KNOWLEDGE_BASE,
    usesLLM: false,
    language,
  };
}

/**
 * Handle out of scope intent
 */
function handleOutOfScope(language: "en" | "kn" | "mixed"): AIResponseResult {
  return {
    content: getOutOfScopeResponse(language),
    intent: Intent.OUT_OF_SCOPE,
    confidence: 100,
    source: RetrievalType.FALLBACK,
    usesLLM: false,
    language,
  };
}

/**
 * Handle knowledge-based intent using knowledge base
 */
async function handleKnowledgeIntent(
  intent: Intent,
  query: string,
  language: "en" | "kn" | "mixed"
): Promise<AIResponseResult> {
  const { articles } = await getKnowledgeContext(query, 3);
  
  if (articles.length === 0) {
    return {
      content: language === "en"
        ? "🙏 I do not have specific information about this topic. Please contact the temple office for assistance."
        : language === "kn"
        ? "🙏 ಈ ವಿಷಯದ ಬಗ್ಗೆ ನಿರ್ದಿಷ್ಟ ಮಾಹಿತಿ ನನಗಿಲ್ಲ. ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ."
        : "🙏 No specific info available. Please contact temple office.",
      intent: intent,
      confidence: 0,
      source: RetrievalType.FALLBACK,
      usesLLM: false,
      language,
    };
  }
  
  // Format knowledge articles in a user-friendly way
  const prefix = language === "en" 
    ? "🙏 Here is some information:\n\n"
    : language === "kn"
    ? "🙏 ಇಲ್ಲಿ ಕೆಲವು ಮಾಹಿತಿ ಇದೆ:\n\n"
    : "🙏 Here is some info / ಇಲ್ಲಿ ಮಾಹಿತಿ ಇದೆ:\n\n";
  
  return {
    content: prefix + formatArticlesForContext(articles),
    intent: intent,
    confidence: 80,
    source: RetrievalType.KNOWLEDGE_BASE,
    usesLLM: false,
    language,
  };
}

/**
 * Main response generator
 * Uses structured retrieval when possible, falls back to knowledge base or LLM
 */
export async function generateResponse(
  message: string
): Promise<AIResponseResult> {
  const language = detectLanguage(message);
  const intentResult = detectIntent(message);
  
  console.log(`[AI Generator] Detected intent: ${intentResult.intent} (${intentResult.confidence}%)`);

  // Handle intents that use structured data
  switch (intentResult.intent) {
    case Intent.TEMPLE_TIMINGS:
    case Intent.DRESS_CODE:
    case Intent.VISITOR_GUIDELINES:
      return handleTempleTimings(language);
      
    case Intent.CONTACT_INFORMATION:
      return handleContactInformation(language);
      
    case Intent.LOCATION:
    case Intent.ADDRESS:
      return handleLocation(language);
      
    case Intent.UPCOMING_EVENTS:
    case Intent.FESTIVAL_INFO:
      return handleEvents(language);
      
    case Intent.SPECIAL_SEVAS:
    case Intent.DAILY_POOJA:
      return handleSevas(language, intentResult.intent);
      
    case Intent.ANNOUNCEMENTS:
      return handleAnnouncements(language);
      
    case Intent.PANCHANGA:
      return handlePanchanga(language);
      
    case Intent.DONATION:
    case Intent.DONATION_PURPOSE:
    case Intent.DONATION_80G:
      if (intentResult.intent === Intent.DONATION_80G) {
        const donationInfo = await getDonationInfo();
        return {
          content: format80GInfo(donationInfo.data?.has80G ?? true),
          intent: Intent.DONATION_80G,
          confidence: donationInfo.confidence,
          source: donationInfo.source,
          usesLLM: false,
          language,
        };
      }
      return handleDonation(language);
      
    case Intent.NEXT_AARADHANE:
      return handleAaradhane(language);
      
    case Intent.GENERAL_GREETING:
      return handleGreeting(language);
      
    case Intent.THANKS:
      return handleThanks(language);
      
    case Intent.OUT_OF_SCOPE:
      return handleOutOfScope(language);
      
    // Knowledge-based intents
    case Intent.TEMPLE_HISTORY:
    case Intent.SRI_RAGHAVENDRA:
    case Intent.MADHWA_PHILOSOPHY:
    case Intent.GURU_PARAMPARA:
    case Intent.BRINDAVANA:
    case Intent.MANTRALAYA:
    case Intent.FAQ:
    case Intent.VOLUNTEER:
    case Intent.TESTIMONIAL:
      return handleKnowledgeIntent(intentResult.intent, message, language);
      
    default:
      // Unknown or unhandled intent - use knowledge base
      return handleKnowledgeIntent(Intent.UNKNOWN, message, language);
  }
}

/**
 * Get response metadata for analytics
 */
export function getResponseMetadata(result: AIResponseResult): Record<string, unknown> {
  return {
    intent: result.intent,
    confidence: result.confidence,
    source: result.source,
    usesLLM: result.usesLLM,
    language: result.language,
  };
}
