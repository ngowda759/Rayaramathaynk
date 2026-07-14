// Language Detection Utility for Raya AI Chatbot
// Detects Kannada vs English to respond in the user's language

export type DetectedLanguage = "en" | "kn" | "mixed";

interface LanguageDetectionResult {
  language: DetectedLanguage;
  hasKannada: boolean;
  hasEnglish: boolean;
  confidence: number;
}

// Kannada Unicode range: U+0C80 to U+0CFF
// Common Kannada characters pattern
const KANNADA_PATTERN = /[\u0C80-\u0CFF]/;

// Common English words for detection (to distinguish from random characters)
const ENGLISH_WORDS = [
  "the", "is", "are", "was", "were", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "can", "may", "might", "must", "shall",
  "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "her", "its", "our", "their", "this", "that", "these", "those",
  "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
  "and", "or", "but", "if", "then", "else", "because", "so", "for", "nor", "yet",
  "a", "an", "in", "on", "at", "to", "from", "by", "with", "of", "about",
  "hello", "hi", "namaste", "namaskar", "please", "thank", "thanks", "sorry",
  "time", "day", "week", "month", "year", "today", "tomorrow", "yesterday",
  "temple", "pooja", "seva", "god", "blessing", "prayer",
];

// Kannada-specific keywords (in Kannada script)
const KANNADA_KEYWORDS = [
  "ನಮಸ್ಕಾರ", // Namaskara
  "ದೇವರ", // Devaru (God)
  "ದೇವಸ್ಥಾನ", // Devasthana (temple)
  "ಪೂಜೆ", // Puje (worship)
  "ಸೇವೆ", // Seva (service)
  "ಮಠ", // Matha
  "ರಾಘವೇಂದ್ರ", // Raghavendra
  "ಸ್ವಾಮಿ", // Swamiji
  "ಹಬ್ಬ", // Habba (festival)
  "ಕ್ಷೇತ್ರ", // Kshetra (sacred place)
  "ತೀರ್ಥ", // Teertha (holy water)
  "ಅಭಿಷೇಕ", // Abhisheka
  "ಅರ್ಚನೆ", // Archane
  "ಶ್ರೀ", // Sri
  "ಗುರು", // Guru
  "ಭಕ್ತ", // Bhakta (devotee)
  "ಕನ್ನಡ", // Kannada
  "ಬೆಂಗಳೂರು", // Bengaluru
  "ಯಲಹಂಕ", // Yelahanka
  "ಬೆಳಗು", // Morning
  "ಸಂಜೆ", // Evening
  "ರಾತ್ರಿ", // Night
  "ದಿನ", // Day
  "ವಿಶೇಷ", // Special
  "ಕೊಡು", // Donate
  "ಸಂಪರ್ಕ", // Contact
  "ಸಮಯ", // Time
  "ಕಾರ್ಯಕ್ರಮ", // Program
];

/**
 * Detects the language of a given text
 * Returns the detected language and detection confidence
 */
export function detectLanguage(text: string): LanguageDetectionResult {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return {
      language: "en",
      hasKannada: false,
      hasEnglish: true,
      confidence: 0,
    };
  }

  const normalizedText = text.trim();
  
  // Check for Kannada characters
  const kannadaMatches = normalizedText.match(KANNADA_PATTERN);
  const hasKannada = kannadaMatches !== null;
  
  // Count Kannada characters
  const kannadaCharCount = hasKannada 
    ? (normalizedText.match(KANNADA_PATTERN) || []).length 
    : 0;
  
  // Check for Kannada keywords
  let kannadaKeywordCount = 0;
  for (const keyword of KANNADA_KEYWORDS) {
    if (normalizedText.includes(keyword)) {
      kannadaKeywordCount++;
    }
  }
  
  // Check for English words
  const lowerText = normalizedText.toLowerCase();
  let englishWordCount = 0;
  for (const word of ENGLISH_WORDS) {
    if (lowerText.includes(word)) {
      englishWordCount++;
    }
  }
  
  // Determine language
  let language: DetectedLanguage;
  let confidence: number;
  
  // If text has Kannada characters, it's primarily Kannada
  if (hasKannada) {
    // Check if it's mixed (has both significant Kannada and English)
    if (englishWordCount > 3 && kannadaCharCount < normalizedText.length * 0.5) {
      language = "mixed";
      confidence = 0.7;
    } else {
      language = "kn";
      confidence = Math.min(0.95, 0.6 + (kannadaKeywordCount * 0.1) + (kannadaCharCount / normalizedText.length * 0.3));
    }
  } else {
    // No Kannada characters, check if it has enough English
    language = "en";
    confidence = Math.min(0.95, 0.5 + (englishWordCount * 0.1));
  }
  
  return {
    language,
    hasKannada,
    hasEnglish: englishWordCount > 0,
    confidence,
  };
}

/**
 * Gets the appropriate greeting based on detected language
 */
export function getGreeting(language: DetectedLanguage): string {
  switch (language) {
    case "kn":
      return "🙏 ನಮಸ್ಕಾರ!";
    case "mixed":
      return "🙏 Namaskara / ನಮಸ್ಕಾರ!";
    case "en":
    default:
      return "🙏 Namaskara!";
  }
}

/**
 * Gets the appropriate closing based on detected language
 */
export function getClosing(language: DetectedLanguage): string {
  switch (language) {
    case "kn":
      return "🙏 ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರಾಯ ನಮಃ.";
    case "mixed":
      return "🙏 Sri Guru Raghavendraya Namaha / ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರಾಯ ನಮಃ.";
    case "en":
    default:
      return "🙏 Sri Guru Raghavendraya Namaha.";
  }
}

/**
 * Checks if a message contains Kannada text
 * Simple utility function for quick checks
 */
export function containsKannada(text: string): boolean {
  if (!text || typeof text !== "string") {
    return false;
  }
  return KANNADA_PATTERN.test(text);
}

/**
 * Checks if a message contains mixed language (both Kannada and significant English)
 */
export function containsMixedLanguage(text: string): boolean {
  const detection = detectLanguage(text);
  return detection.language === "mixed";
}
