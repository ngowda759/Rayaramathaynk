/**
 * UX Service for Raya AI
 * Provides quick actions, suggested questions, and user experience features
 */

import { Intent } from "@/lib/ai/intent/types";

/**
 * Quick Action Button
 */
export interface QuickAction {
  id: string;
  label: string;
  labelKn?: string; // Kannada label
  icon?: string;
  action: string; // The message to send when clicked
  intent?: Intent;
}

/**
 * Suggested Question
 */
export interface SuggestedQuestion {
  id: string;
  text: string;
  textKn?: string; // Kannada text
  action: string;
}

/**
 * Get quick actions based on current intent/topic
 */
export function getQuickActions(intent?: Intent, language: "en" | "kn" | "mixed" = "en"): QuickAction[] {
  // Default quick actions (always shown at start)
  const defaultActions: QuickAction[] = [
    {
      id: "timings",
      label: "Temple Timings",
      labelKn: "ದೇವಸ್ಥಾನ ಸಮಯ",
      icon: "🕐",
      action: "What are the temple timings?",
      intent: Intent.TEMPLE_TIMINGS,
    },
    {
      id: "events",
      label: "Events",
      labelKn: "ಕಾರ್ಯಕ್ರಮಗಳು",
      icon: "📅",
      action: "What events are happening soon?",
      intent: Intent.UPCOMING_EVENTS,
    },
    {
      id: "sevas",
      label: "Seva Services",
      labelKn: "ಸೇವೆಗಳು",
      icon: "🙏",
      action: "What sevas are available?",
      intent: Intent.SPECIAL_SEVAS,
    },
    {
      id: "donate",
      label: "Donate",
      labelKn: "ದಾನ",
      icon: "💝",
      action: "How can I make a donation?",
      intent: Intent.DONATION,
    },
  ];

  // Context-specific quick actions
  const contextActions: Record<string, QuickAction[]> = {
    [Intent.TEMPLE_TIMINGS]: [
      {
        id: "morning",
        label: "Morning Timings",
        labelKn: "ಬೆಳಗಿನ ಸಮಯ",
        icon: "🌅",
        action: "What are the morning timings?",
      },
      {
        id: "evening",
        label: "Evening Timings",
        labelKn: "ಸಂಜೆ ಸಮಯ",
        icon: "🌆",
        action: "What are the evening timings?",
      },
      {
        id: "aaradhane",
        label: "Aaradhane",
        labelKn: "ಆರಾಧನೆ",
        icon: "🪔",
        action: "When is the next aaradhane?",
        intent: Intent.NEXT_AARADHANE,
      },
    ],
    [Intent.DONATION]: [
      {
        id: "80g",
        label: "80G Certificate",
        labelKn: "೮೦ಜಿ ಪ್ರಮಾಣಪತ್ರ",
        icon: "📄",
        action: "How do I get 80G certificate?",
        intent: Intent.DONATION_80G,
      },
      {
        id: "online",
        label: "Online Payment",
        labelKn: "ಆನ್‌ಲೈನ್ ಪಾವತಿ",
        icon: "💳",
        action: "How can I donate online?",
      },
      {
        id: "bank",
        label: "Bank Details",
        labelKn: "ಬ್ಯಾಂಕ್ ವಿವರಗಳು",
        icon: "🏦",
        action: "What are the bank account details?",
      },
    ],
    [Intent.SPECIAL_SEVAS]: [
      {
        id: "archana",
        label: "Archana",
        labelKn: "ಆರ್ಚನೆ",
        icon: "🪔",
        action: "Tell me about Archana",
      },
      {
        id: "annadana",
        label: "Annadanam",
        labelKn: "ಅನ್ನದಾನಂ",
        icon: "🍚",
        action: "What is Annadanam?",
        intent: Intent.ANNADANA,
      },
      {
        id: "seva_book",
        label: "Book Seva",
        labelKn: "ಸೇವೆ ಬುಕ್",
        icon: "📝",
        action: "How do I book a seva?",
      },
    ],
    [Intent.UPCOMING_EVENTS]: [
      {
        id: "aaradhane",
        label: "Next Aaradhane",
        labelKn: "ಮುಂದಿನ ಆರಾಧನೆ",
        icon: "🪔",
        action: "When is the next aaradhane?",
        intent: Intent.NEXT_AARADHANE,
      },
      {
        id: "festivals",
        label: "Festivals",
        labelKn: "ಹಬ್ಬಗಳು",
        icon: "🎉",
        action: "What festivals are celebrated?",
        intent: Intent.FESTIVAL_INFO,
      },
      {
        id: "special_days",
        label: "Special Days",
        labelKn: "ವಿಶೇಷ ದಿನಗಳು",
        icon: "⭐",
        action: "Are there any special days coming up?",
      },
    ],
    [Intent.LOCATION]: [
      {
        id: "directions",
        label: "Directions",
        labelKn: "ದಿಕ್ಕುಗಳು",
        icon: "🗺️",
        action: "How do I get to the temple?",
      },
      {
        id: "parking",
        label: "Parking",
        labelKn: "ಪಾರ್ಕಿಂಗ್",
        icon: "🅿️",
        action: "Is there parking available?",
        intent: Intent.PARKING,
      },
      {
        id: "nearby",
        label: "Nearby Places",
        labelKn: "ಹತ್ತಿರದ ಸ್ಥಳಗಳು",
        icon: "📍",
        action: "What places are nearby the temple?",
      },
    ],
    [Intent.VISITOR_GUIDELINES]: [
      {
        id: "dress",
        label: "Dress Code",
        labelKn: "ಉಡುಗೆ ನಿಯಮ",
        icon: "👔",
        action: "What is the dress code?",
        intent: Intent.DRESS_CODE,
      },
      {
        id: "photos",
        label: "Photography",
        labelKn: "ಛಾಯಾಗ್ರಹಣ",
        icon: "📷",
        action: "Is photography allowed?",
        intent: Intent.PHOTOGRAPHY,
      },
      {
        id: "prasada",
        label: "Prasada",
        labelKn: "ಪ್ರಸಾದ",
        icon: "🍬",
        action: "What is prasada?",
        intent: Intent.PRASADA,
      },
    ],
  };

  // Return context-specific actions if available, otherwise defaults
  if (intent && contextActions[intent]) {
    return [...defaultActions, ...contextActions[intent]];
  }

  return defaultActions;
}

/**
 * Get suggested questions based on current context
 */
export function getSuggestedQuestions(intent?: Intent, language: "en" | "kn" | "mixed" = "en"): SuggestedQuestion[] {
  const suggestions: Record<string, SuggestedQuestion[]> = {
    default: [
      {
        id: "temple_info",
        text: "What are the temple timings?",
        textKn: "ದೇವಸ್ಥಾನದ ಸಮಯ ಏನು?",
        action: "What are the temple timings?",
      },
      {
        id: "donation_info",
        text: "How can I donate?",
        textKn: "ನಾನು ಹೇಗೆ ದಾನ ಮಾಡಬಹುದು?",
        action: "How can I make a donation?",
      },
      {
        id: "events_info",
        text: "Any upcoming events?",
        textKn: "ಯಾವುದೇ ಬರುತ್ತಿರುವ ಕಾರ್ಯಕ್ರಮಗಳು?",
        action: "Are there any upcoming events?",
      },
      {
        id: "seva_info",
        text: "What sevas are available?",
        textKn: "ಯಾವ ಸೇವೆಗಳು ಲಭ್ಯವಿವೆ?",
        action: "What sevas are available?",
      },
    ],
    [Intent.TEMPLE_TIMINGS]: [
      {
        id: "morning",
        text: "What time does morning pooja start?",
        textKn: "ಬೆಳಗಿನ ಪೂಜೆ ಯಾವಾಗ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ?",
        action: "What time does the morning pooja start?",
      },
      {
        id: "evening",
        text: "What time does evening pooja start?",
        textKn: "ಸಂಜೆ ಪೂಜೆ ಯಾವಾಗ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ?",
        action: "What time does the evening pooja start?",
      },
      {
        id: "aaradhane",
        text: "When is the next aaradhane?",
        textKn: "ಮುಂದಿನ ಆರಾಧನೆ ಯಾವಾಗ?",
        action: "When is the next aaradhane?",
      },
    ],
    [Intent.DONATION]: [
      {
        id: "80g",
        text: "Do you provide 80G certificate?",
        textKn: "೮೦ಜಿ ಪ್ರಮಾಣಪತ್ರ ನೀಡುತ್ತೀರಾ?",
        action: "Do you provide 80G tax exemption certificate?",
      },
      {
        id: "online",
        text: "Can I donate online?",
        textKn: "ನಾನು ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ದಾನ ಮಾಡಬಹುದೇ?",
        action: "Can I donate online?",
      },
      {
        id: "account",
        text: "What are the bank details?",
        textKn: "ಬ್ಯಾಂಕ್ ವಿವರಗಳು ಏನು?",
        action: "What are the bank account details?",
      },
    ],
    [Intent.NEXT_AARADHANE]: [
      {
        id: "aaradhane_details",
        text: "Tell me about aaradhane",
        textKn: "ಆರಾಧನೆಯ ಬಗ್ಗೆ ಹೇಳಿ",
        action: "Tell me more about the aaradhane festival",
      },
      {
        id: "aaradhane_timing",
        text: "What is the aaradhane schedule?",
        textKn: "ಆರಾಧನೆಯ ವೇಳಾಪಪಟ್ಟಿ ಏನು?",
        action: "What is the schedule during aaradhane?",
      },
      {
        id: "aaradhane_special",
        text: "What makes it special?",
        textKn: "ಏನು ವಿಶೇಷ?",
        action: "What makes aaradhane special?",
      },
    ],
  };

  if (intent && suggestions[intent]) {
    return suggestions[intent];
  }

  return suggestions.default;
}

/**
 * Get greeting with quick actions
 */
export function getGreetingWithActions(language: "en" | "kn" | "mixed" = "en"): {
  greeting: string;
  quickActions: QuickAction[];
} {
  const greetings = {
    en: "🙏 Namaskara! Welcome to Sri Raghavendra Swamy Matha. How may I assist you today?",
    kn: "🙏 ನಮಸ್ಕಾರ! ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠಕ್ಕೆ ಸ್ವಾಗತ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
    mixed: "🙏 Namaskara / ನಮಸ್ಕಾರ! Welcome to Sri Raghavendra Swamy Matha.",
  };

  return {
    greeting: greetings[language],
    quickActions: getQuickActions(undefined, language),
  };
}

/**
 * Get response metadata for frontend UX
 */
export function getResponseMetadata(intent?: Intent, language: "en" | "kn" | "mixed" = "en"): {
  showTypingIndicator: boolean;
  showQuickActions: boolean;
  showSuggestedQuestions: boolean;
  quickActions: QuickAction[];
  suggestedQuestions: SuggestedQuestion[];
} {
  return {
    showTypingIndicator: true,
    showQuickActions: true,
    showSuggestedQuestions: intent === undefined,
    quickActions: getQuickActions(intent, language),
    suggestedQuestions: getSuggestedQuestions(intent, language),
  };
}
