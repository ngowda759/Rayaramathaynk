import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

import {
  DEFAULT_AI_GENERAL_SETTINGS,
  DEFAULT_AI_SAFETY_SETTINGS,
  DEFAULT_AI_EXTENDED_BEHAVIOR_SETTINGS,
  DEFAULT_AI_BEHAVIOR_SETTINGS,
  DEFAULT_TEMPLE_INFORMATION,
  DEFAULT_VISITOR_INFORMATION,
  DEFAULT_TEMPLE_POLICIES,
  DEFAULT_AI_RESPONSES,
} from "../types/ai-settings";

// Note: I will copy the values from types/ai-settings.ts in the code to ensure we have valid seed data.

const promptContent = `You are Raya AI, a helpful virtual assistant for Sri Raghavendra Swamy Matha, Yelahanka.

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

const DEFAULT_INTENTS = [
  {
    id: "intent-1",
    intentId: "TEMPLE_TIMINGS",
    name: "Temple Timings",
    description: "Questions about temple opening and closing times",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "timing", language: "en", isActive: true },
      { keyword: "timings", language: "en", isActive: true },
      { keyword: "time", language: "en", isActive: true },
      { keyword: "schedule", language: "en", isActive: true },
      { keyword: "open", language: "en", isActive: true },
      { keyword: "close", language: "en", isActive: true },
      { keyword: "morning", language: "en", isActive: true },
      { keyword: "evening", language: "en", isActive: true },
      { keyword: "ಸಮಯ", language: "kn", isActive: true },
      { keyword: "ತೆರೆಯಲು", language: "kn", isActive: true },
    ],
    examples: [
      { text: "What are the temple timings?", language: "en" },
      { text: "When does the temple open?", language: "en" },
      { text: "ಮಠದ ಸಮಯ ಏನು?", language: "kn" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-2",
    intentId: "CONTACT_INFORMATION",
    name: "Contact Information",
    description: "Questions about phone, email, and contact details",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "contact", language: "en", isActive: true },
      { keyword: "phone", language: "en", isActive: true },
      { keyword: "email", language: "en", isActive: true },
      { keyword: "call", language: "en", isActive: true },
      { keyword: "number", language: "en", isActive: true },
      { keyword: "ಸಂಪರ್ಕ", language: "kn", isActive: true },
      { keyword: "ಫೋನ್", language: "kn", isActive: true },
    ],
    examples: [
      { text: "What is the phone number?", language: "en" },
      { text: "How can I contact the temple?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-3",
    intentId: "LOCATION",
    name: "Location",
    description: "Questions about temple location and directions",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "location", language: "en", isActive: true },
      { keyword: "where", language: "en", isActive: true },
      { keyword: "located", language: "en", isActive: true },
      { keyword: "how to reach", language: "en", isActive: true },
      { keyword: "directions", language: "en", isActive: true },
      { keyword: "map", language: "en", isActive: true },
      { keyword: "ಎಲ್ಲಿ", language: "kn", isActive: true },
      { keyword: "ಸ್ಥಳ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "Where is the temple located?", language: "en" },
      { text: "How to reach the temple?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-4",
    intentId: "UPCOMING_EVENTS",
    name: "Upcoming Events",
    description: "Questions about upcoming events and programs",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "event", language: "en", isActive: true },
      { keyword: "events", language: "en", isActive: true },
      { keyword: "upcoming", language: "en", isActive: true },
      { keyword: "next", language: "en", isActive: true },
      { keyword: "schedule", language: "en", isActive: true },
      { keyword: "ಕಾರ್ಯಕ್ರಮ", language: "kn", isActive: true },
      { keyword: "ಹಬ್ಬ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "What events are coming up?", language: "en" },
      { text: "Any special programs this week?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-5",
    intentId: "NEXT_AARADHANE",
    name: "Next Aaradhane",
    description: "Questions about Sri Raghavendra Swamy Aaradhane dates",
    status: "enabled",
    confidence: 0.9,
    usageCount: 0,
    keywords: [
      { keyword: "aaradhane", language: "en", isActive: true },
      { keyword: "aradhana", language: "en", isActive: true },
      { keyword: "aradhana mahotsava", language: "en", isActive: true },
      { keyword: "annual", language: "en", isActive: true },
      { keyword: "anniversary", language: "en", isActive: true },
      { keyword: "ಆರಾಧನೆ", language: "kn", isActive: true },
      { keyword: "ಮಹೋತ್ಸವ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "When is the next aaradhane?", language: "en" },
      { text: "Rayara Aaradhane ಯಾವಾಗ?", language: "mixed" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-6",
    intentId: "DONATION",
    name: "Donation",
    description: "Questions about making donations",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "donate", language: "en", isActive: true },
      { keyword: "donation", language: "en", isActive: true },
      { keyword: "donations", language: "en", isActive: true },
      { keyword: "contribute", language: "en", isActive: true },
      { keyword: "support", language: "en", isActive: true },
      { keyword: "offering", language: "en", isActive: true },
      { keyword: "ದೇಣ", language: "kn", isActive: true },
      { keyword: "ಕೊಡು", language: "kn", isActive: true },
    ],
    examples: [
      { text: "How can I make a donation?", language: "en" },
      { text: "I want to donate to the temple", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-7",
    intentId: "SPECIAL_SEVAS",
    name: "Special Sevas",
    description: "Questions about special sevas like archana, abhisheka",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "seva", language: "en", isActive: true },
      { keyword: "sevas", language: "en", isActive: true },
      { keyword: "archana", language: "en", isActive: true },
      { keyword: "abhisheka", language: "en", isActive: true },
      { keyword: "tulasi", language: "en", isActive: true },
      { keyword: "ಸೇವೆ", language: "kn", isActive: true },
      { keyword: "ಅರ್ಚನೆ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "What sevas are available?", language: "en" },
      { text: "How to book archana?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-8",
    intentId: "DRESS_CODE",
    name: "Dress Code",
    description: "Questions about appropriate dress for temple visit",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "dress", language: "en", isActive: true },
      { keyword: "dress code", language: "en", isActive: true },
      { keyword: "wear", language: "en", isActive: true },
      { keyword: "clothing", language: "en", isActive: true },
      { keyword: "attire", language: "en", isActive: true },
      { keyword: "ಉಡುಗೆ", language: "kn", isActive: true },
      { keyword: "ತೊಡುಗೆ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "What should I wear to the temple?", language: "en" },
      { text: "Is there a dress code?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-9",
    intentId: "PARKING",
    name: "Parking",
    description: "Questions about parking facilities",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "parking", language: "en", isActive: true },
      { keyword: "park", language: "en", isActive: true },
      { keyword: "car", language: "en", isActive: true },
      { keyword: "vehicle", language: "en", isActive: true },
      { keyword: "bike", language: "en", isActive: true },
      { keyword: "ಪಾರ್ಕಿಂಗ್", language: "kn", isActive: true },
    ],
    examples: [
      { text: "Is there parking available?", language: "en" },
      { text: "Where can I park?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-10",
    intentId: "GENERAL_GREETING",
    name: "General Greeting",
    description: "Greetings and namaste messages",
    status: "enabled",
    confidence: 0.95,
    usageCount: 0,
    keywords: [
      { keyword: "hello", language: "en", isActive: true },
      { keyword: "hi", language: "en", isActive: true },
      { keyword: "hey", language: "en", isActive: true },
      { keyword: "namaste", language: "en", isActive: true },
      { keyword: "namaskar", language: "en", isActive: true },
      { keyword: "ನಮಸ್ಕಾರ", language: "kn", isActive: true },
      { keyword: "ಹಲೋ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "Hello", language: "en" },
      { text: "Namaste", language: "en" },
      { text: "ನಮಸ್ಕಾರ", language: "kn" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-11",
    intentId: "THANKS",
    name: "Thanks",
    description: "Thank you messages",
    status: "enabled",
    confidence: 0.95,
    usageCount: 0,
    keywords: [
      { keyword: "thank", language: "en", isActive: true },
      { keyword: "thanks", language: "en", isActive: true },
      { keyword: "thankyou", language: "en", isActive: true },
      { keyword: "appreciate", language: "en", isActive: true },
      { keyword: "grateful", language: "en", isActive: true },
      { keyword: "ಧನ್ಯವಾದ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "Thank you", language: "en" },
      { text: "Thanks a lot", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-12",
    intentId: "GOODBYE",
    name: "Goodbye",
    description: "Farewell messages",
    status: "enabled",
    confidence: 0.95,
    usageCount: 0,
    keywords: [
      { keyword: "bye", language: "en", isActive: true },
      { keyword: "goodbye", language: "en", isActive: true },
      { keyword: "see you", language: "en", isActive: true },
      { keyword: "take care", language: "en", isActive: true },
      { keyword: "ಬಾಯ್", language: "kn", isActive: true },
      { keyword: "ಜನಾಂದೋಗ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "Bye", language: "en" },
      { text: "Goodbye", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-13",
    intentId: "PANCHANGA",
    name: "Panchanga",
    description: "Questions about daily panchanga (Tithi, Nakshatra, etc.)",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "panchanga", language: "en", isActive: true },
      { keyword: "tithi", language: "en", isActive: true },
      { keyword: "nakshatra", language: "en", isActive: true },
      { keyword: "ತಿಥಿ", language: "kn", isActive: true },
      { keyword: "ನಕ್ಷತ್ರ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "What is today's tithi?", language: "en" },
      { text: "ಇಂದು ಯಾವ ತಿಥಿ?", language: "kn" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-14",
    intentId: "SRI_RAGHAVENDRA",
    name: "Sri Raghavendra Swamy",
    description: "Questions about Sri Raghavendra Swamy",
    status: "enabled",
    confidence: 0.9,
    usageCount: 0,
    keywords: [
      { keyword: "raghavendra", language: "en", isActive: true },
      { keyword: "swamy", language: "en", isActive: true },
      { keyword: "rayara", language: "en", isActive: true },
      { keyword: "ರಾಘವೇಂದ್ರ", language: "kn", isActive: true },
      { keyword: "ರಾಯರ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "Who is Sri Raghavendra Swamy?", language: "en" },
      { text: "Tell me about Rayara", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-15",
    intentId: "BRINDAVANA",
    name: "Brindavana",
    description: "Questions about the sacred Brindavana",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "brindavana", language: "en", isActive: true },
      { keyword: "brindavan", language: "en", isActive: true },
      { keyword: "ಬೃಂದಾವನ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "What is the brindavana?", language: "en" },
      { text: "Tell me about the Brindavana", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent-16",
    intentId: "FAQ",
    name: "FAQ",
    description: "General frequently asked questions",
    status: "enabled",
    confidence: 0.7,
    usageCount: 0,
    keywords: [
      { keyword: "faq", language: "en", isActive: true },
      { keyword: "question", language: "en", isActive: true },
      { keyword: "answer", language: "en", isActive: true },
      { keyword: "help", language: "en", isActive: true },
      { keyword: "what", language: "en", isActive: true },
      { keyword: "why", language: "en", isActive: true },
      { keyword: "how", language: "en", isActive: true },
      { keyword: "ಪ್ರಶ್ನೆ", language: "kn", isActive: true },
      { keyword: "ಉತ್ತರ", language: "kn", isActive: true },
    ],
    examples: [
      { text: "What is this place?", language: "en" },
      { text: "How does this work?", language: "en" },
    ],
    createdAt: new Date(),
  },
];

async function seed() {
  console.log("Seeding Supabase ai_settings...");

  const defaultSettings = {
    id: "main",
    general: DEFAULT_AI_GENERAL_SETTINGS,
    safety: DEFAULT_AI_SAFETY_SETTINGS,
    extended_behavior: DEFAULT_AI_EXTENDED_BEHAVIOR_SETTINGS,
    temple_information: DEFAULT_TEMPLE_INFORMATION,
    visitor_information: DEFAULT_VISITOR_INFORMATION,
    temple_policies: DEFAULT_TEMPLE_POLICIES,
    ai_responses: DEFAULT_AI_RESPONSES,
    ai_behavior: DEFAULT_AI_BEHAVIOR_SETTINGS, // Using extended behavior as legacy for now
    prompt: {
        currentPromptId: "prompt_v1_seed",
        versions: [{
            id: "prompt_v1_seed",
            name: "Prompt v1",
            version: 1,
            content: promptContent,
            status: "published",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: "system"
        }],
        defaultPrompt: promptContent,
    },
    intents: { intents: DEFAULT_INTENTS }, // Will need to get intent list if possible, but starting with empty is safe and the app relies on knowledge docs too
    updated_at: new Date().toISOString(),
    updated_by: "system",
    version: 1
  };

  const { data, error } = await supabase
    .from("ai_settings")
    .upsert(defaultSettings);

  if (error) {
    console.error("Error seeding ai_settings:", error);
    process.exit(1);
  }

  console.log("Successfully seeded ai_settings.");
}

seed().catch(console.error);
