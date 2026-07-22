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
  formatArticlesWithSources,
  getSuggestedFollowUps,
  getGreetingResponse,
  getClosingResponse,
  getOutOfScopeResponse,
  getThankYouResponse,
} from "./knowledge";

import { containsKannada } from "./intent/patterns";
import { logUnknownQuestion } from "@/services/analytics.service";
import { quoteService } from "@/services/quote.service";
import type { Quote, QuoteCategory } from "@/types/quote";

export { detectIntent } from "./intent";

// Confidence threshold for triggering FAQ fallback
const LOW_CONFIDENCE_THRESHOLD = 60;

export { LOW_CONFIDENCE_THRESHOLD };

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
  debugInfo?: {
    quoteId?: string;
    category?: string;
    reason?: string;
    ruleApplied?: string;
    cacheHit?: boolean;
  };
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
 * Handle FAQ intent for generic/unclear questions
 */
function handleFAQIntent(message: string, language: "en" | "kn" | "mixed"): AIResponseResult {
  const responses = {
    en: `🙏 Namaskara! I can help you with various temple-related queries.

I specialize in:
• 🕐 Temple timings and schedules
• 📅 Events and festivals
• 🙏 Sevas and booking
• 💝 Donations (including 80G)
• 📿 Panchanga information
• 📖 Temple history and philosophy
• 📍 Location and directions

Could you please rephrase your question? For example:
• "What are the temple timings?"
• "When is the next Aaradhane?"
• "How can I donate?"

🙏 Sri Guru Raghavendraya Namaha.`,

    kn: `🙏 ನಮಸ್ಕಾರ! ನಾನು ವಿವಿಧ ದೇವಸ್ಥಾನದ ಮಾಹಿತಿಯನ್ನು ನೀಡಬಹುದು.

ನಾನು ಸಹಾಯ ಮಾಡಬಹುದು:
• 🕐 ದೇವಸ್ಥಾನದ ಸಮಯ
• 📅 ಕಾರ್ಯಕ್ರಮಗಳು ಮತ್ತು ಹಬ್ಬಗಳು
• 🙏 ಸೇವೆಗಳು
• 💝 ದೇಣಗಳು
• 📿 ಪಂಚಾಂಗ ಮಾಹಿತಿ
• 📍 ಸ್ಥಳ

ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಮರುಹೇಳಿ. ಉದಾಹರಣೆಗೆ:
• "ದೇವಸ್ಥಾನದ ಸಮಯ ಏನು?"
• "ಆರಾಧನೆ ಯಾವಾಗ?"

🙏 ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ನಮಃ`,

    mixed: `🙏 Namaskara! ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಹುದು.

I can help with temple timings, events, sevas, donations, panchanga & more.

Please rephrase your question / ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆಯನ್ನು ಹೇಳಿ.

🙏 Sri Guru Raghavendraya Namaha.`
  };

  return {
    content: responses[language],
    intent: Intent.FAQ,
    confidence: 80,
    source: RetrievalType.FALLBACK,
    usesLLM: false,
    language,
  };
}

/**
 * Handle volunteer intent
 */
function handleVolunteer(language: "en" | "kn" | "mixed"): AIResponseResult {
  const responses = {
    en: `🙏 **Volunteer Opportunities**

We welcome devotees to join our volunteer (sevadhar) program!

**How to Join:**
- Register online: [Volunteer Registration](/volunteer)
- Contact the temple office during working hours
- Phone: +91-80-28446400
- Email: info@raghavendramatha.org

**Volunteer Services:**
- Pooja assistance
- Annadanam (free meals) service
- Crowd management during festivals
- Temple maintenance
- Event coordination

Training is provided for all volunteers. Your service (seva) is considered a sacred offering.

🙏 Sri Guru Raghavendraya Namaha.`,

    kn: `🙏 **ಸ್ವಯಂಸೇವಕರ ಅವಕಾಶಗಳು**

ನಮ್ಮ ಸೇವಾಧಾರ ಕಾರ್ಯಕ್ರಮಕ್ಕೆ ಭಕ್ತರನ್ನು ಸ್ವಾಗತಿಸುತ್ತೇವೆ!

**ಹೇಗೆ ಸೇರಬೇಕು:**
- ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ನೋಂದಣಿ ಮಾಡಿ: [ಸ್ವಯಂಸೇವಕ ನೋಂದಣಿ](/volunteer)
- ಕಛೇರಿ ಸಮಯದಲ್ಲಿ ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ
- ಫೋನ್: +91-80-28446400

**ಸೇವೆಗಳು:**
- ಪೂಜೆ ಸಹಾಯ
- ಅನ್ನದಾನಂ ಸೇವೆ
- ಹಬ್ಬದ ಸಮಯದಲ್ಲಿ ಜನಸಂಪರ್ಕ

🙏 ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ನಮಃ`,

    mixed: `🙏 **Volunteer / ಸ್ವಯಂಸೇವೆ**

Join our volunteer program!
- Register online: [Volunteer Registration](/volunteer)
Contact: +91-80-28446400

Your service is a sacred offering.

🙏 Sri Guru Raghavendraya Namaha.`
  };

  return {
    content: responses[language],
    intent: Intent.VOLUNTEER,
    confidence: 100,
    source: RetrievalType.FALLBACK,
    usesLLM: false,
    language,
  };
}

/**
 * Handle share experience / testimonial intent
 */
function handleShareExperience(language: "en" | "kn" | "mixed"): AIResponseResult {
  const responses = {
    en: `🙏 **Share Your Spiritual Experience**

We invite devotees to share their spiritual experiences and testimonials at Sri Raghavendra Swamy Matha.

**How to Share:**
1. **Write to us:** Submit your testimonial via the temple website
2. **Suggestion Box:** Drop your written testimonial at the temple suggestion box
3. **Email:** info@raghavendramatha.org

Your experiences inspire and guide fellow devotees on their spiritual journey.

**What to Share:**
- Your experience during darshan
- blessings received
- Stories of Sri Guru's grace
- How the temple has helped you

🙏 Thank you for being part of our spiritual family!`,

    kn: `🙏 **ನಿಮ್ಮ ಆತ್ಮೀಯ ಅನುಭವವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ**

ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದಲ್ಲಿ ನಿಮ್ಮ ಆತ್ಮೀಯ ಅನುಭವಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ನಾವು ಭಕ್ತರನ್ನು ಆಹ್ವಾನಿಸುತ್ತೇವೆ.

**ಹೇಗೆ ಹಂಚಿಕೊಳ್ಳುವುದು:**
- ವೆಬ್‌ಸೈಟ್‌ನ ಮೂಲಕ ಬರೆಯಿರಿ
- ದೇವಸ್ಥಾನದ ಸೂಚನಾ ಪೆಟ್ಟಿಗೆಯಲ್ಲಿ ಬಿಡಿ
- ಇಮೇಲ್: info@raghavendramatha.org

🙏 ಧನ್ಯವಾದಗಳು!`,

    mixed: `🙏 **Share Experience / ಅನುಭವ**

Share your spiritual journey!
- Website testimonial form
- Suggestion box at temple
- Email: info@raghavendramatha.org

🙏 Sri Guru Raghavendraya Namaha.`
  };

  return {
    content: responses[language],
    intent: Intent.SHARE_EXPERIENCE,
    confidence: 100,
    source: RetrievalType.FALLBACK,
    usesLLM: false,
    language,
  };
}

/**
 * Handle daily quote intent using QuoteService
 */
async function handleDailyQuote(
  message: string,
  language: "en" | "kn" | "mixed",
  sessionId?: string
): Promise<AIResponseResult> {
  try {
    // Check if this is a follow-up request for another quote
    const isFollowUp = /another|one more|next|different|other/i.test(message);
    const currentCategory = sessionId ? getLastQuoteCategory(sessionId) : null;
    
    // Get today's quote from QuoteService
    const result = await quoteService.getTodaysQuote();
    const quote = result.quote;
    
    if (!quote) {
      // Provide a devotional fallback message with a curated quote
      const fallbackContent = language === "en"
        ? `🙏 **Today's Devotional Inspiration**

ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಹಾರಾಜರು ಎಂದೆಂಟು ದಿನ ಮಲಗಿ ಎದ್ದರು | ಮಠದ ಮೇಲೆ ನಿಂತು ಅವರನ್ನು ನೋಡಿದರು ||
ಮಠದ ಕೆಳಗೆ ನಿಂತು ಅವರನ್ನು ನೋಡಿದರು ||

*Salutations to the Lord of Sri Raghavendra Swamy, who woke up early and looked upon the matha from above and below.*

📚 **Source:** Traditional Sri Raghavendra Swamy Devotion
🏷️ **Category:** Guru Vandana

🙏 *May Sri Guru's blessings be with you always. Sri Guru Raghavendraya Namaha.*`
        : language === "kn"
        ? `🙏 **ಇಂದಿನ ಭಕ್ತಿ ಸಂದೇಶ**

ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಹಾರಾಜರು ಎಂದೆಂಟು ದಿನ ಮಲಗಿ ಎದ್ದರು | ಮಠದ ಮೇಲೆ ನಿಂತು ಅವರನ್ನು ನೋಡಿದರು ||
ಮಠದ ಕೆಳಗೆ ನಿಂತು ಅವರನ್ನು ನೋಡಿದರು ||

*ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯ ಆರಾಧನೆ*

📚 **ಮೂಲ:** ಸಾಂಪ್ರದಾಯಿಕ ಭಕ್ತಿ
🏷️ **ವರ್ಗ:** ಗುರು ವಂದನಾ

🙏 *ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ನಮಃ*`
        : `🙏 **Today's Devotional Quote / ಇಂದಿನ ಭಕ್ತಿ ಸಂದೇಶ**

ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಹಾರಾಜರು...

📚 **Source / ಮೂಲ:** Traditional Sri Raghavendra Swamy Devotion
🏷️ **Category / ವರ್ಗ:** Guru Vandana

🙏 Sri Guru Raghavendraya Namaha.`;
      
      return {
        content: fallbackContent,
        intent: Intent.DAILY_QUOTE,
        confidence: 50,
        source: RetrievalType.FALLBACK,
        usesLLM: false,
        language,
      };
    }

    // Format the quote response
    const quoteContent = formatQuoteResponse(quote, result.context, language);
    
    // Add awareness messages based on context
    const awarenessMessages = getQuoteAwarenessMessages(result.context, language);
    
    // Build the full response
    let response = awarenessMessages.prefix + quoteContent + awarenessMessages.suffix;

    // Build debug info
    const debugInfo = {
      quoteId: quote.id,
      category: quote.category,
      reason: result.context.reason,
      ruleApplied: result.context.reason.split(":")[0],
      cacheHit: result.metadata.cached,
    };

    // Check if debug mode is enabled
    let debugMode = false;
    try {
      const { aiSettingsService } = await import("@/lib/ai/ai-settings");
      const behavior = await aiSettingsService.getAIBehavior();
      debugMode = behavior.debugMode;
    } catch {
      // Debug mode check failed, continue without debug info
    }

    // Add debug info to response if enabled
    if (debugMode) {
      const debugText = language === "en"
        ? `\n\n---\n🔧 **Debug Info**\n- Intent: DAILY_QUOTE\n- Quote ID: ${debugInfo.quoteId}\n- Category: ${debugInfo.category}\n- Selection Reason: ${debugInfo.reason}\n- Rule Applied: ${debugInfo.ruleApplied}\n- Source: QuoteService\n- Cache: ${debugInfo.cacheHit ? "Hit" : "Miss"}\n---`
        : language === "kn"
        ? `\n\n---\n🔧 **ಡೀಬಗ್ ಮಾಹಿತಿ**\n- ಉದ್ದೇಶ: DAILY_QUOTE\n- ಉಲ್ಲೇಖ ID: ${debugInfo.quoteId}\n- ವರ್ಗ: ${debugInfo.category}\n- ಆಯ್ಕೆ ಕಾರಣ: ${debugInfo.reason}\n- ನಿಯಮ: ${debugInfo.ruleApplied}\n- ಮೂಲ: QuoteService\n- ಸಂಗ್ರಹ: ${debugInfo.cacheHit ? "ಹಿಟ್" : "ಮಿಸ್"}\n---`
        : `\n\n---\n🔧 **Debug Info**\n- Intent: DAILY_QUOTE\n- Quote ID: ${debugInfo.quoteId}\n- Category: ${debugInfo.category}\n- Selection Reason: ${debugInfo.reason}\n- Rule Applied: ${debugInfo.ruleApplied}\n- Source: QuoteService\n- Cache: ${debugInfo.cacheHit ? "Hit" : "Miss"}\n---`;
      
      response += debugText;
    }

    // Track the quote category in session for follow-up requests
    if (sessionId) {
      setLastQuoteCategory(sessionId, quote.category);
    }

    return {
      content: response,
      intent: Intent.DAILY_QUOTE,
      confidence: 95,
      source: RetrievalType.REPOSITORY,
      usesLLM: false,
      language,
      debugInfo,
    };
  } catch (error) {
    console.error("[AI Generator] Error fetching daily quote:", error);
    return {
      content: language === "en"
        ? "🙏 I encountered an error retrieving today's quote. Please try again later."
        : language === "kn"
        ? "🙏 ಇಂದಿನ ಉಲ್ಲೇಖವನ್ನು ಪಡೆಯುವಾಗ ದೋಷ ಉಂಟಾಯಿತು. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
        : "🙏 Error retrieving quote. Please try again.",
      intent: Intent.DAILY_QUOTE,
      confidence: 0,
      source: RetrievalType.FALLBACK,
      usesLLM: false,
      language,
    };
  }
}

/**
 * Format quote response based on language
 */
function formatQuoteResponse(
  quote: Quote,
  context: { category: QuoteCategory; reason: string },
  language: "en" | "kn" | "mixed"
): string {
  const primaryText = quote.content.kannada || quote.content.sanskrit || quote.content.transliteration || "";
  const translation = quote.content.translationEnglish || "";
  
  let content = "";
  
  if (language === "en") {
    content = `📖 **Today's Devotional Quote**

${primaryText}

${translation ? `*Translation:* ${translation}` : ""}

📚 **Source:** ${quote.source}${quote.author ? ` by ${quote.author}` : ""}
🏷️ **Category:** ${getCategoryLabel(quote.category, "en")}
${quote.verseNumber ? `📝 **Verse:** ${quote.verseNumber}` : ""}`;
  } else if (language === "kn") {
    content = `📖 **ಇಂದಿನ ಭಕ್ತಿ ಉಲ್ಲೇಖ**

${primaryText}

${translation ? `*ಅನುವಾದ:* ${translation}` : ""}

📚 **ಮೂಲ:** ${quote.source}${quote.author ? ` - ${quote.author}` : ""}
🏷️ **ವರ್ಗ:** ${getCategoryLabel(quote.category, "kn")}
${quote.verseNumber ? `📝 **ಪದ್ಯ:** ${quote.verseNumber}` : ""}`;
  } else {
    // Mixed language
    content = `📖 **Today's Devotional Quote / ಇಂದಿನ ಭಕ್ತಿ ಉಲ್ಲೇಖ**

${primaryText}

${translation ? `*Translation / ಅನುವಾದ:* ${translation}` : ""}

📚 **Source / ಮೂಲ:** ${quote.source}
🏷️ **Category / ವರ್ಗ:** ${getCategoryLabel(quote.category, "en")}`;
  }
  
  return content;
}

/**
 * Get category label based on language
 */
function getCategoryLabel(category: QuoteCategory, language: "en" | "kn"): string {
  const labels: Record<QuoteCategory, { en: string; kn: string }> = {
    raghavendra_stotra: { en: "Sri Raghavendra Stotra", kn: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ತೋತ್ರ" },
    mangalashtakam: { en: "Sri Raghavendra Mangalashtakam", kn: "ಮಂಗಳಾಷ್ಟಕ" },
    guru_vandana: { en: "Guru Vandana", kn: "ಗುರು ವಂದನಾ" },
    authentic_teachings: { en: "Authentic Teachings", kn: "ಸಾರ್ವತ್ರಿಕ ಉಪದೇಶ" },
    devotional_sayings: { en: "Devotional Sayings", kn: "ಭಕ್ತಿ ವಚನಗಳು" },
    madhwa_philosophy: { en: "Madhwa Philosophy", kn: "ಮಾಧ್ವ ತತ್ವ" },
  };
  
  return labels[category]?.[language] || category;
}

/**
 * Get awareness messages based on selection context
 */
function getQuoteAwarenessMessages(
  context: { category: QuoteCategory; reason: string },
  language: "en" | "kn" | "mixed"
): { prefix: string; suffix: string } {
  const dayOfWeek = new Date().getDay();
  const isThursday = dayOfWeek === 4;
  const isFestival = context.reason.toLowerCase().includes("festival");
  const hasPanchangaInfluence = context.reason.toLowerCase().includes("panchanga");
  
  let prefix = "";
  let suffix = "";
  
  // Thursday awareness
  if (isThursday && context.category === "guru_vandana") {
    if (language === "en") {
      prefix = "🙏 Today is Thursday, so today's devotional message comes from Guru Vandana.\n\n";
    } else if (language === "kn") {
      prefix = "🙏 ಇಂದು ಗುರುವಾರ, ಆದ್ದರಿಂದ ಇಂದಿನ ಭಕ್ತಿ ಸಂದೇಶ ಗುರು ವಂದನೆಯಿಂದ.\n\n";
    } else {
      prefix = "🙏 Today is Thursday, so today's message comes from Guru Vandana.\n\n";
    }
  }
  
  // Festival awareness
  if (isFestival) {
    const festivalName = extractFestivalName(context.reason);
    if (language === "en") {
      suffix += `\n\n✨ Today's quote is selected specially for ${festivalName}.`;
    } else if (language === "kn") {
      suffix += `\n\n✨ ಇಂದಿನ ಉಲ್ಲೇಖ ${festivalName} ಗೆ ವಿಶೇಷವಾಗಿ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ.`;
    } else {
      suffix += `\n\n✨ Today's quote is specially selected for ${festivalName}.`;
    }
  }
  
  // Panchanga awareness
  if (hasPanchangaInfluence) {
    if (language === "en") {
      suffix += `\n\n🌟 Today's Panchanga has influenced the devotional quote selection.`;
    } else if (language === "kn") {
      suffix += `\n\n🌟 ಇಂದಿನ ಪಂಚಾಂಗ ಭಕ್ತಿ ಉಲ್ಲೇಖ ಆಯ್ಕೆಯನ್ನು ಪ್ರಭಾವಿಸಿದೆ.`;
    } else {
      suffix += `\n\n🌟 Today's Panchanga has influenced the quote selection.`;
    }
  }
  
  // Closing
  if (language === "en") {
    suffix += `\n\n🙏 Sri Guru Raghavendraya Namaha.`;
  } else if (language === "kn") {
    suffix += `\n\n🙏 ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ನಮಃ`;
  } else {
    suffix += `\n\n🙏 Sri Guru Raghavendraya Namaha.`;
  }
  
  return { prefix, suffix };
}

/**
 * Extract festival name from reason string
 */
function extractFestivalName(reason: string): string {
  const festivalMap: Record<string, string> = {
    "raghavendra_aradhana": "Sri Raghavendra Aradhana",
    "guru_purnima": "Guru Purnima",
    "madhwa_navami": "Madhwa Navami",
    "vyasa_pooja": "Vyasa Pooja",
    "brahmotsava": "Brahmotsava",
  };
  
  for (const [key, name] of Object.entries(festivalMap)) {
    if (reason.toLowerCase().includes(key)) {
      return name;
    }
  }
  
  return "the festival";
}

// In-memory session tracking for quote follow-ups
const quoteSessionCache = new Map<string, { category: QuoteCategory; quoteId: string }>();

/**
 * Get last quote category from session
 */
function getLastQuoteCategory(sessionId: string): QuoteCategory | null {
  return quoteSessionCache.get(sessionId)?.category || null;
}

/**
 * Set last quote category for session
 */
function setLastQuoteCategory(sessionId: string, category: QuoteCategory): void {
  quoteSessionCache.set(sessionId, { category, quoteId: "" });
  // Clean up after 30 minutes
  setTimeout(() => quoteSessionCache.delete(sessionId), 30 * 60 * 1000);
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
  
  // Use enhanced knowledge formatting with source attribution
  const { content: formattedContent, sourceAttribution } = formatArticlesWithSources(articles, language);
  
  // Determine category from first article for follow-up suggestions
  const category = articles[0]?.category || null;
  const followUps = getSuggestedFollowUps(category, language);
  
  // Format knowledge articles with source attribution
  const prefix = language === "en" 
    ? "🙏 Here is some information:\n\n"
    : language === "kn"
    ? "🙏 ಇಲ್ಲಿ ಕೆಲವು ಮಾಹಿತಿ ಇದೆ:\n\n"
    : "🙏 Here is some info / ಇಲ್ಲಿ ಮಾಹಿತಿ ಇದೆ:\n\n";
  
  // Build follow-up suggestions
  const followUpText = language === "en"
    ? `\n\n---\n\n💡 **You might also want to know:**\n${followUps.slice(0, 2).map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : language === "kn"
    ? `\n\n---\n\n💡 **ನೀವು ಇದನ್ನೂ ತಿಳಿಯಬಹುದು:**\n${followUps.slice(0, 2).map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : `\n\n---\n\n💡 **Also ask / ಇದನ್ನೂ ಕೇಳಿ:**\n${followUps.slice(0, 2).map((q, i) => `${i + 1}. ${q}`).join("\n")}`;
  
  return {
    content: prefix + formattedContent + followUpText + `\n\n${sourceAttribution}`,
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
  message: string,
  sessionId?: string
): Promise<AIResponseResult> {
  const language = detectLanguage(message);
  const intentResult = detectIntent(message);
  
  console.log(`[AI Generator] Detected intent: ${intentResult.intent} (${intentResult.confidence}%)`);

  // Low confidence fallback - redirect to FAQ for better UX
  if (intentResult.confidence < LOW_CONFIDENCE_THRESHOLD && 
      intentResult.intent !== Intent.OUT_OF_SCOPE &&
      intentResult.intent !== Intent.GENERAL_GREETING &&
      intentResult.intent !== Intent.THANKS &&
      intentResult.intent !== Intent.GOODBYE) {
    console.log(`[AI Generator] Low confidence (${intentResult.confidence}%), redirecting to FAQ`);
    
    // Log unknown question for analytics
    await logUnknownQuestion({
      question: message,
      detectedIntent: intentResult.intent,
      confidence: intentResult.confidence,
      language,
      sessionId,
    });
    
    return handleFAQIntent(message, language);
  }

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
      
    case Intent.DAILY_QUOTE:
      return handleDailyQuote(message, language, sessionId);
      
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
    case Intent.TESTIMONIAL:
      return handleKnowledgeIntent(intentResult.intent, message, language);
    
    case Intent.VOLUNTEER:
      return handleVolunteer(language);
    
    case Intent.SHARE_EXPERIENCE:
      return handleShareExperience(language);
      
    case Intent.FAQ:
      return handleFAQIntent(message, language);
      
    default:
      // Unknown or unhandled intent - log and use knowledge base
      await logUnknownQuestion({
        question: message,
        detectedIntent: intentResult.intent,
        confidence: intentResult.confidence,
        language,
        sessionId,
      });
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
