// Intent Patterns - Keywords and patterns for intent detection
import { Intent, IntentCategory, IntentPriority, IntentPattern } from "./types";

// Kannada Unicode range: U+0C80 to U+0CFF
const KANNADA_PATTERN = /[\u0C80-\u0CFF]/;

export const INTENT_PATTERNS: IntentPattern[] = [
  // ==================== TEMPLE INFORMATION ====================
  {
    intent: Intent.TEMPLE_TIMINGS,
    category: IntentCategory.TEMPLE_INFO,
    priority: IntentPriority.TEMPLE_TIMINGS,
    keywords: {
      en: [
        "timing", "timings", "time", "schedule", "open", "close", "closed",
        "morning", "evening", "afternoon", "when open", "when close",
        "working hours", "visiting hours", "hours of operation",
        "ಸಮಯ", "ತೆರೆಯಲು", "ಮುಚ್ಚಲು", "ಎಷ್ಟು ಹೊತ್ತು"
      ],
      kn: [
        "ಸಮಯ", "ತೆರೆಯಲು", "ಮುಚ್ಚಲು", "ಎಷ್ಟು ಹೊತ್ತು", "ಬೆಳಗು", "ಸಂಜೆ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.CONTACT_INFORMATION,
    category: IntentCategory.TEMPLE_INFO,
    priority: IntentPriority.CONTACT_INFORMATION,
    keywords: {
      en: [
        "contact", "phone", "email", "call", "reach", "number",
        "mobile", "telephone", "reach", "connect",
        "ಸಂಪರ್ಕ", "ಫೋನ್", "ಇಮೇಲ್"
      ],
      kn: [
        "ಸಂಪರ್ಕ", "ಫೋನ್", "ಇಮೇಲ್", "ಕರೆ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.LOCATION,
    category: IntentCategory.TEMPLE_INFO,
    priority: IntentPriority.LOCATION,
    keywords: {
      en: [
        "location", "where", "located", "how to reach", "directions",
        "map", "google maps", "navigate", "find",
        "ಎಲ್ಲಿ", "ಸ್ಥಳ", "ಹೇಗೆ ಹೋಗುವುದು"
      ],
      kn: [
        "ಎಲ್ಲಿ", "ಸ್ಥಳ", "ಹೇಗೆ ಹೋಗುವುದು", "ದಾರಿ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.ADDRESS,
    category: IntentCategory.TEMPLE_INFO,
    priority: IntentPriority.ADDRESS,
    keywords: {
      en: [
        "address", "street", "area", "neighbourhood", "road",
        "yelahanka", "bengaluru", "bangalore", "karnataka",
        "ವಿಳಾಸ", "ಠಾಣೆ", "ಊರು"
      ],
      kn: [
        "ವಿಳಾಸ", "ಠಾಣೆ", "ಊರು", "ಯಲಹಂಕ", "ಬೆಂಗಳೂರು"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.OFFICE_HOURS,
    category: IntentCategory.TEMPLE_INFO,
    priority: IntentPriority.OFFICE_HOURS,
    keywords: {
      en: [
        "office hours", "office timing", "admin", "administration",
        "administrative", "when is office", "office open",
        "ಕಛೇರಿ ಸಮಯ", "ಆಡಳಿತ"
      ],
      kn: [
        "ಕಛೇರಿ ಸಮಯ", "ಆಡಳಿತ", "ಕಛೇರಿ"
      ]
    },
    requiresStructuredData: true,
  },

  // ==================== EVENTS & FESTIVALS ====================
  {
    intent: Intent.UPCOMING_EVENTS,
    category: IntentCategory.EVENTS,
    priority: IntentPriority.UPCOMING_EVENTS,
    keywords: {
      en: [
        "event", "events", "upcoming", "next", "schedule",
        "program", "programme", "celebration", "happening",
        "ಕಾರ್ಯಕ್ರಮ", "ಹಬ್ಬ", "ಉತ್ಸವ", "ಬರುತ್ತಿರುವ"
      ],
      kn: [
        "ಕಾರ್ಯಕ್ರಮ", "ಹಬ್ಬ", "ಉತ್ಸವ", "ಬರುತ್ತಿರುವ", "ಕಾರ್ಯಕ್ರಮಗಳು"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.NEXT_AARADHANE,
    category: IntentCategory.EVENTS,
    priority: IntentPriority.NEXT_AARADHANE,
    keywords: {
      en: [
        "aaradhane", "aradhana", "aradhana mahotsava",
        "annual", "anniversary", "when is aaradhane",
        "ಆರಾಧನೆ", "ಮಹೋತ್ಸವ"
      ],
      kn: [
        "ಆರಾಧನೆ", "ಮಹೋತ್ಸವ", "ಆರಾಧನಾ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.FESTIVAL_INFO,
    category: IntentCategory.EVENTS,
    priority: IntentPriority.UPCOMING_EVENTS,
    keywords: {
      en: [
        "festival", "festivals", "utsavam", "utsava",
        "celebration", "special day", "holiday",
        "ಉತ್ಸವ", "ಹಬ್ಬ", "ವಿಶೇಷ ದಿನ"
      ],
      kn: [
        "ಉತ್ಸವ", "ಹಬ್ಬ", "ವಿಶೇಷ ದಿನ"
      ]
    },
    requiresStructuredData: true,
  },

  // ==================== DEVOTIONAL CONTENT ====================
  {
    intent: Intent.DAILY_QUOTE,
    category: IntentCategory.DEVOTIONAL,
    priority: IntentPriority.DAILY_QUOTE,
    keywords: {
      en: [
        "quote", "quotes", "daily quote", "today quote", "todays quote",
        "quote of the day", "devotional quote", "spiritual quote",
        "blessing", "blessings", "rayaru", "rayaru quote", "guru quote",
        "verse", "verses", "verse of the day", "daily verse",
        "prayer", "prayers", "daily prayer", "todays prayer",
        "devotional message", "guru message", "inspiration",
        "daily inspiration", "raghavendra quote", "mangalashtakam",
        "stotra", "sloka", "shloka",
        "another quote", "one more quote", "next verse", "different quote"
      ],
      kn: [
        "ಉಲ್ಲೇಖ", "ದಿನದ ಉಲ್ಲೇಖ", "ಇಂದಿನ ಉಲ್ಲೇಖ",
        "ರಾಯರ ಉಲ್ಲೇಖ", "ರಾಯರ ಸಂದೇಶ", "ಗುರು ಸಂದೇಶ",
        "ಇಂದಿನ ಶ್ಲೋಕ", "ಇಂದಿನ ಸಂದೇಶ",
        "ಇಂದಿನ ಪ್ರಾರ್ಥನೆ", "ಇಂದಿನ ಆಶೀರ್ವಾದ",
        "ರಾಯರ ಶ್ಲೋಕ", "ಮಂಗಳಾಷ್ಟಕ",
        "ಶ್ಲೋಕ", "ಸ್ತೋತ್ರ", "ವಚನ",
        "ಮತ್ತೊಂದು ಉಲ್ಲೇಖ", "ಇನ್ನೊಂದು ಶ್ಲೋಕ",
        "ಬೇರೆ ಉಲ್ಲೇಖ", "ಮತ್ತೊಂದು ವಚನ"
      ]
    },
    requiresStructuredData: true,
  },

  // ==================== SEVAS & WORSHIP ====================
  {
    intent: Intent.SPECIAL_SEVAS,
    category: IntentCategory.SEVAS,
    priority: IntentPriority.SPECIAL_SEVAS,
    keywords: {
      en: [
        "seva", "sevas", "service", "services", "special service",
        "archana", "abhisheka", "tulasi",
        "kanike", "vastra", "udayastamana",
        "ಸೇವೆ", "ಅರ್ಚನೆ", "ಅಭಿಷೇಕ", "ತುಲಸಿ"
      ],
      kn: [
        "ಸೇವೆ", "ಅರ್ಚನೆ", "ಅಭಿಷೇಕ", "ತುಲಸಿ", "ವಿಶೇಷ ಸೇವೆ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.ANNADANA,
    category: IntentCategory.SEVAS,
    priority: IntentPriority.ANNADANA,
    keywords: {
      en: [
        "annadana", "anna dane", "free meals", "free food",
        "lunch", "dinner", "meal", "food service",
        "ಅನ್ನದಾನ", "ಉಚಿತ ಊಟ", "ಊಟ", "ಅನ್ನ"
      ],
      kn: [
        "ಅನ್ನದಾನ", "ಉಚಿತ ಊಟ", "ಊಟ", "ಅನ್ನ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.PRASADA,
    category: IntentCategory.SEVAS,
    priority: IntentPriority.PRASADA,
    keywords: {
      en: [
        "prasada", "prasad", "prasaad", "sacred food", "blessed food",
        "tirtha", "theertha", "holy water", "charanamrut",
        "ಪ್ರಸಾದ", "ತೀರ್ಥ", "ಪವಿತ್ರ ಆಹಾರ"
      ],
      kn: [
        "ಪ್ರಸಾದ", "ತೀರ್ಥ", "ಪವಿತ್ರ ಆಹಾರ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.DAILY_POOJA,
    category: IntentCategory.SEVAS,
    priority: IntentPriority.DAILY_POOJA,
    keywords: {
      en: [
        "pooja", "puja", "prayer", "worship", "daily pooja",
        "suprabhata", "mangalarati", "teertha", "archana",
        "ಪೂಜೆ", "ಪ್ರಾರ್ಥನೆ", "ಆರಾಧನೆ"
      ],
      kn: [
        "ಪೂಜೆ", "ಪ್ರಾರ್ಥನೆ", "ಆರಾಧನೆ", "ದೈನಿಕ ಪೂಜೆ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.SEVA_BOOKING,
    category: IntentCategory.SEVAS,
    priority: IntentPriority.SEVA_BOOKING,
    keywords: {
      en: [
        "book", "booking", "schedule", "register", "request",
        "schedule a", "book a", "book for",
        "ಬುಕ್", "ಕಾಯ್ದಿರಿಸು", "ನೋಂದಾಯಿಸು"
      ],
      kn: [
        "ಬುಕ್", "ಕಾಯ್ದಿರಿಸು", "ನೋಂದಾಯಿಸು"
      ]
    },
    requiresStructuredData: false, // Goes to booking flow
  },

  // ==================== DONATIONS ====================
  {
    intent: Intent.DONATION,
    category: IntentCategory.DONATIONS,
    priority: IntentPriority.DONATION,
    keywords: {
      en: [
        "donate", "donation", "donations", "contribute", "contribution",
        "support", "offering", "give", "giving",
        "ದೇಣ", "ಕೊಡು", "ಕೊಡುಗೆ", "ದಾನ"
      ],
      kn: [
        "ದೇಣ", "ಕೊಡು", "ಕೊಡುಗೆ", "ದಾನ", "ಧಾರೆ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.DONATION_PURPOSE,
    category: IntentCategory.DONATIONS,
    priority: IntentPriority.DONATION,
    keywords: {
      en: [
        "where goes", "where does", "how used", "fund utilization",
        "purpose", "cause", "what for",
        "ಎಲ್ಲಿ ಹೋಗುತ್ತದೆ", "ಏನಿಗೆ", "ಉದ್ದೇಶ"
      ],
      kn: [
        "ಎಲ್ಲಿ ಹೋಗುತ್ತದೆ", "ಏನಿಗೆ", "ಉದ್ದೇಶ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.DONATION_80G,
    category: IntentCategory.DONATIONS,
    priority: IntentPriority.DONATION,
    keywords: {
      en: [
        "80g", "80g certificate", "tax", "tax deductible", "tax benefit",
        "receipt", "donation receipt", "tax exemption",
        "ತೆರಿಗೆ", "80ಜಿ", "ರಸೀದಿ"
      ],
      kn: [
        "ತೆರಿಗೆ", "ರಸೀದಿ"
      ]
    },
    requiresStructuredData: true,
  },

  // ==================== ANNOUNCEMENTS ====================
  {
    intent: Intent.ANNOUNCEMENTS,
    category: IntentCategory.ANNOUNCEMENTS,
    priority: IntentPriority.ANNOUNCEMENTS,
    keywords: {
      en: [
        "announcement", "announcements", "notice", "update",
        "news", "notice board", "important",
        "ಘೋಷಣೆ", "ಸುದ್ದಿ", "ಮಾಹಿತಿ"
      ],
      kn: [
        "ಘೋಷಣೆ", "ಸುದ್ದಿ", "ಮಾಹಿತಿ", "ಅಧಿಸೂಚನೆ"
      ]
    },
    requiresStructuredData: true,
  },

  // ==================== PANCHANGA ====================
  {
    intent: Intent.PANCHANGA,
    category: IntentCategory.PANCHANGA,
    priority: IntentPriority.PANCHANGA,
    keywords: {
      en: [
        "panchanga", "panchang", "tithi", "nakshatra", "yoga",
        "karana", "rahu kalam", "gulikai", "sunrise", "sunset",
        "ಪಂಚಾಂಗ", "ತಿಥಿ", "ನಕ್ಷತ್ರ", "ಯೋಗ"
      ],
      kn: [
        "ಪಂಚಾಂಗ", "ತಿಥಿ", "ನಕ್ಷತ್ರ", "ಯೋಗ"
      ]
    },
    requiresStructuredData: true,
  },

  // ==================== KNOWLEDGE & HISTORY ====================
  {
    intent: Intent.TEMPLE_HISTORY,
    category: IntentCategory.KNOWLEDGE,
    priority: IntentPriority.TEMPLE_HISTORY,
    keywords: {
      en: [
        "history", "about", "established", "founded", "origin",
        "background", "story", "how it started",
        "ಇತಿಹಾಸ", "ಹಿನ್ನೆಲೆ", "ಸ್ಥಾಪನೆ"
      ],
      kn: [
        "ಇತಿಹಾಸ", "ಹಿನ್ನೆಲೆ", "ಸ್ಥಾಪನೆ", "ಬಗ್ಗೆ"
      ]
    },
    requiresStructuredData: false, // From knowledge base
  },
  {
    intent: Intent.SRI_RAGHAVENDRA,
    category: IntentCategory.KNOWLEDGE,
    priority: IntentPriority.SRI_RAGHAVENDRA,
    keywords: {
      en: [
        "raghavendra", "swamy", "guru", "sri guru",
        "madduramma", "vishu", "math", "matha",
        "ರಾಘವೇಂದ್ರ", "ಸ್ವಾಮಿ", "ಗುರು"
      ],
      kn: [
        "ರಾಘವೇಂದ್ರ", "ಸ್ವಾಮಿ", "ಗುರು", "ಮಠ"
      ]
    },
    requiresStructuredData: false, // From knowledge base
  },
  {
    intent: Intent.MADHWA_PHILOSOPHY,
    category: IntentCategory.KNOWLEDGE,
    priority: IntentPriority.TEMPLE_HISTORY,
    keywords: {
      en: [
        "madhva", "madhvacharya", "dvaita", "philosophy",
        "dualism", "tattva", "tatva",
        "ಮಾಧ್ವ", "ದ್ವೈತ", "ತತ್ವ"
      ],
      kn: [
        "ಮಾಧ್ವ", "ದ್ವೈತ", "ತತ್ವ"
      ]
    },
    requiresStructuredData: false,
  },
  {
    intent: Intent.GURU_PARAMPARA,
    category: IntentCategory.KNOWLEDGE,
    priority: IntentPriority.TEMPLE_HISTORY,
    keywords: {
      en: [
        "parampara", "lineage", "guru", "tradition",
        "succession", "chain",
        "ಪರಂಪರೆ", "ವಂಶಾವಳಿ", "ಗುರು"
      ],
      kn: [
        "ಪರಂಪರೆ", "ವಂಶಾವಳಿ"
      ]
    },
    requiresStructuredData: false,
  },

  // ==================== VISITOR INFORMATION ====================
  {
    intent: Intent.VISITOR_GUIDELINES,
    category: IntentCategory.VISITOR,
    priority: IntentPriority.TEMPLE_TIMINGS,
    keywords: {
      en: [
        "rules", "guidelines", "guidance", "information",
        "do and dont", "instructions", "things to know",
        "ನಿಯಮಗಳು", "ಮಾರ್ಗದರ್ಶನ"
      ],
      kn: [
        "ನಿಯಮಗಳು", "ಮಾರ್ಗದರ್ಶನ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.DRESS_CODE,
    category: IntentCategory.VISITOR,
    priority: IntentPriority.TEMPLE_TIMINGS,
    keywords: {
      en: [
        "dress", "dress code", "wear", "clothing", "attire",
        "what to wear", "appropriate",
        "ಉಡುಗೆ", "ತೊಡುಗೆ", "ಬಟ್ಟೆ"
      ],
      kn: [
        "ಉಡುಗೆ", "ತೊಡುಗೆ", "ಬಟ್ಟೆ"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.PARKING,
    category: IntentCategory.VISITOR,
    priority: IntentPriority.PARKING,
    keywords: {
      en: [
        "parking", "park", "car", "vehicle", "bike", "bicycle",
        "where to park", "parking fee", "parking charges",
        "ಪಾರ್ಕಿಂಗ್", "ಕಾರು", "ವಾಹನ"
      ],
      kn: [
        "ಪಾರ್ಕಿಂಗ್", "ಕಾರು", "ವಾಹನ", "ಎಲ್ಲಿ ಪಾರ್ಕ್ ಮಾಡುವುದು"
      ]
    },
    requiresStructuredData: true,
  },
  {
    intent: Intent.PHOTOGRAPHY,
    category: IntentCategory.VISITOR,
    priority: IntentPriority.PHOTOGRAPHY,
    keywords: {
      en: [
        "photography", "photo", "picture", "camera", "video",
        "can i take photo", "filming", "mobile photo",
        "ಛಾಯಾಗ್ರಹಣ", "ಫೋಟೊ", "ವೀಡಿಯೊ"
      ],
      kn: [
        "ಛಾಯಾಗ್ರಹಣ", "ಫೋಟೊ", "ವೀಡಿಯೊ"
      ]
    },
    requiresStructuredData: true,
  },

  // ==================== WEBSITE NAVIGATION ====================
  {
    intent: Intent.SHARE_EXPERIENCE,
    category: IntentCategory.WEBSITE_NAVIGATION,
    priority: IntentPriority.SHARE_EXPERIENCE,
    keywords: {
      en: [
        "share experience", "share my experience", "tell my experience",
        "write testimonial", "submit testimonial", "post experience",
        "how was my visit", "share visit", "my review",
        "ಅನುಭವ ಹಂಚಿಕೊಳ್ಳಿ", "ನನ್ನ ಅನುಭವ"
      ],
      kn: [
        "ಅನುಭವ ಹಂಚಿಕೊಳ್ಳಿ", "ನನ್ನ ಅನುಭವ", "ತಿಳಿಸಿಕೊಳ್ಳಿ"
      ]
    },
    requiresStructuredData: false,
  },
  {
    intent: Intent.COMMITTEE,
    category: IntentCategory.WEBSITE_NAVIGATION,
    priority: IntentPriority.COMMITTEE,
    keywords: {
      en: [
        "committee", "trust committee", "board", "members",
        "who runs", "management", "governing body", "trustees",
        "ಸಮಿತಿ", "ಟ್ರಸ್ಟ್", "ಆಡಳಿತ ಮಂಡಳಿ"
      ],
      kn: [
        "ಸಮಿತಿ", "ಟ್ರಸ್ಟ್", "ಆಡಳಿತ ಮಂಡಳಿ", "ಸದಸ್ಯರು"
      ]
    },
    requiresStructuredData: true,
  },

  // ==================== ACTIONS ====================
  {
    intent: Intent.TESTIMONIAL,
    category: IntentCategory.ACTIONS,
    priority: IntentPriority.THANKS,
    keywords: {
      en: [
        "testimonial", "share", "experience", "review",
        "feedback", "my experience", "tell you",
        "ಅನುಭವ", "ಸಾಕ್ಷಿ"
      ],
      kn: [
        "ಅನುಭವ", "ಸಾಕ್ಷಿ", "ಹಂಚಿಕೊಳ್ಳಿ"
      ]
    },
    requiresStructuredData: false,
  },
  {
    intent: Intent.VOLUNTEER,
    category: IntentCategory.ACTIONS,
    priority: IntentPriority.THANKS,
    keywords: {
      en: [
        "volunteer", "volunteering", "serve", "service",
        "help", "participate", "join",
        "ಸ್ಯಾಂಪಂದನಾ", "ಸೇವೆ"
      ],
      kn: [
        "ಸ್ಯಾಂಪಂದನಾ", "ಸೇವೆ", "ಸ್ವಯಂಸೇವಕ"
      ]
    },
    requiresStructuredData: false,
  },
  {
    intent: Intent.CONTACT_REQUEST,
    category: IntentCategory.ACTIONS,
    priority: IntentPriority.THANKS,
    keywords: {
      en: [
        "contact temple", "talk to", "speak to", "reach temple",
        "need help", "want to ask",
        "ದೇವಸ್ಥಾನ ಸಂಪರ್ಕ"
      ],
      kn: [
        "ಸಂಪರ್ಕಿಸಬೇಕು", "ಮಾತನಾಡಬೇಕು"
      ]
    },
    requiresStructuredData: true,
  },

  // ==================== FAQ ====================
  {
    intent: Intent.FAQ,
    category: IntentCategory.FAQ,
    priority: IntentPriority.FAQ,
    keywords: {
      en: [
        "faq", "question", "answer", "help",
        "can i", "is it possible", "tell me",
        "what do you", "what are you", "who are you", "what is this",
        "what", "why", "how", "which", "where", "when",
        "meaning", "purpose", "reason", "explain",
        "ಪ್ರಶ್ನೆ", "ಉತ್ತರ", "ಏನು", "ಹೇಗೆ", "ಯಾವ", "ಯಾರು"
      ],
      kn: [
        "ಪ್ರಶ್ನೆ", "ಉತ್ತರ", "ಏನು", "ಹೇಗೆ", "ಯಾವ", "ಯಾರು"
      ]
    },
    requiresStructuredData: false,
  },

  // ==================== GENERAL ====================
  {
    intent: Intent.GENERAL_GREETING,
    category: IntentCategory.GENERAL,
    priority: IntentPriority.GREETING,
    keywords: {
      en: [
        "hello", "hi", "hey", "namaste", "namaskar", "good morning",
        "good evening", "good afternoon", "greetings",
        "ನಮಸ್ಕಾರ", "ಹಲೋ", "ವಂದನೆ"
      ],
      kn: [
        "ನಮಸ್ಕಾರ", "ಹಲೋ", "ವಂದನೆ", "ಸ್ವಾಗತ"
      ]
    },
    requiresStructuredData: false,
  },
  {
    intent: Intent.THANKS,
    category: IntentCategory.GENERAL,
    priority: IntentPriority.THANKS,
    keywords: {
      en: [
        "thank", "thanks", "thankyou", "appreciate", "grateful",
        "ಧನ್ಯವಾದ", "ಕೃತಜ್ಞತೆ"
      ],
      kn: [
        "ಧನ್ಯವಾದ", "ಕೃತಜ್ಞತೆ"
      ]
    },
    requiresStructuredData: false,
  },
  {
    intent: Intent.GOODBYE,
    category: IntentCategory.GENERAL,
    priority: IntentPriority.GOODBYE,
    keywords: {
      en: [
        "bye", "goodbye", "see you", "take care", "tata",
        "ಬಾಯ್", "ಜನಾಂದೋಗ"
      ],
      kn: [
        "ಜನಾಂದೋಗ", "ಬಾಯ್"
      ]
    },
    requiresStructuredData: false,
  },
];

// Out of scope patterns - common off-topic queries
export const OUT_OF_SCOPE_PATTERNS = [
  // Programming & Tech (removed "code" - used in "dress code")
  /\b(python|javascript|java|c\+\+|programming|coding|bug|debug|software|app|website)\b/i,
  // Stock & Finance
  /\b(stock market|share market|market trading|stock trading|trading|invest|business|profit|loss|bitcoin|crypto|cryptocurrency)\b/i,
  // Weather
  /\b(weather|rain|temperature|forecast|climate)\b/i,
  // Politics & Government
  /\b(politics|election|government|minister|cm|mp|mla|vote|polling|prime minister|pm\b|president|governor|chief minister|cm\b|political)\b/i,
  // Entertainment
  /\b(movie|film|series|netflix|amazon prime|disney|hotstar|song|music)\b/i,
  // Sports
  /\b(cricket|football|ipl| match|score|team|player|coach|rcb|india match|karnataka team)\b/i,
  // General off-topic
  /\b(repair|fix|buy|sell|price|recipe|food|restaurant|hotel booking|flight|train booking)\b/i,
  // Technology
  /\b(wifi|internet|charging station|ev charging|electric vehicle)\b/i,
  // Education
  /\b(school|college|university|admission|exam|results)\b/i,
];

// Out of scope keywords
export const OUT_OF_SCOPE_KEYWORDS = {
  en: [
    "politics", "weather", "stock market", "bitcoin", "cryptocurrency",
    "repair", "fix my", "buy a", "sell my", "python code",
    "write code", "movie", "recipe", "prime minister", "pm", "president",
    "wifi password", "ev charging", "electric vehicle charging"
  ],
  kn: [
    "ರಾಜಕಾರಣ", "ಹವಾಮಾನ", "ಸ್ಟಾಕ್", "ಬಿಟ್‌ಕಾಯಿನ್"
  ]
};

/**
 * Check if text contains Kannada characters
 */
export function containsKannada(text: string): boolean {
  return KANNADA_PATTERN.test(text);
}

/**
 * Normalize text for matching (lowercase, trim)
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}
