/**
 * Seed AI Settings to Firestore
 * Seeds prompts, intents, and default settings for Raya AI
 */

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const fs = require("fs");

// Initialize Firebase Admin
function initFirebase() {
  if (!getApps() || !getApps().length) {
    const serviceAccount = JSON.parse(
      fs.readFileSync("firebase-admin.json", "utf8")
    );
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return getFirestore();
}

// Default prompt
const DEFAULT_PROMPT = `You are Raya AI, a helpful virtual assistant for Sri Raghavendra Swamy Matha, Yelahanka.

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

// Default intents from patterns.ts
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

async function seedAISettings() {
  console.log("\n" + "=".repeat(60));
  console.log("AI SETTINGS SEEDER");
  console.log("=".repeat(60));

  // Check for firebase-admin.json
  if (!fs.existsSync("firebase-admin.json")) {
    console.error("\nError: firebase-admin.json not found!");
    process.exit(1);
  }

  const db = initFirebase();

  // Create initial prompt version
  const initialPromptVersion = {
    id: "prompt_v1_" + Date.now(),
    name: "Prompt v1",
    version: 1,
    content: DEFAULT_PROMPT,
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "system",
    publishedAt: new Date(),
    publishedBy: "system",
    changeNotes: "Initial prompt version",
  };

  const settingsData = {
    prompt: {
      currentPromptId: initialPromptVersion.id,
      versions: [initialPromptVersion],
      defaultPrompt: DEFAULT_PROMPT,
    },
    intents: {
      intents: DEFAULT_INTENTS,
    },
    templeInformation: {
      timings: {
        morningOpen: "6:00 AM",
        morningClose: "12:00 PM",
        eveningOpen: "5:00 PM",
        eveningClose: "8:30 PM",
      },
      contact: {
        phone: "+91-80-28446400",
        email: "info@raghavendramatha.org",
        address: "Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru - 560064, Karnataka, India",
      },
      officeHours: {
        weekday: "9:00 AM - 5:00 PM",
        weekend: "10:00 AM - 4:00 PM",
      },
    },
    visitorInformation: {
      guidelines: "Remove footwear before entering. Maintain silence and decorum inside the temple.",
      dressCode: "Traditional attire preferred. Saree, Kurta, Dhoti recommended.",
      photographyPolicy: "Photography not allowed inside sanctum. Flash photography prohibited.",
      parking: "Free parking available at main and east entrances.",
      facilities: "Wheelchair access, drinking water, restrooms available.",
    },
    templePolicies: {
      donations: "Donations are welcome. Bank transfers, UPI accepted.",
      information80G: "80G tax exemption available for donations. Contact office for certificate.",
      sevaBooking: "Special sevas can be booked online or at temple counter.",
    },
    aiResponses: {
      greeting: "🙏 Namaskara! Welcome to Sri Raghavendra Swamy Matha. How may I help you?",
      welcome: "🙏 Welcome! I'm here to help with temple information, darshan timings, sevas, and more.",
      fallback: "🙏 Let me provide you with the most relevant information I have.",
      unknownQuestion: "🙏 I couldn't find verified information about that. Please contact the temple office for confirmation.",
      outOfScope: "🙏 I'm specifically designed to help with temple-related queries. Please contact the temple office for other topics.",
      goodbye: "🙏 Sri Guru Raghavendraya Namaha! Thank you for visiting. Please feel free to return anytime!",
    },
    aiBehavior: {
      confidenceThreshold: 0.85,
      semanticThreshold: 0.7,
      maxRelatedArticles: 3,
      conversationTimeout: 30,
      streaming: false,
      debugMode: false,
      unknownLogging: true,
    },
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "system",
  };

  const docRef = db.collection("ai_settings").doc("main");
  const existingDoc = await docRef.get();

  if (existingDoc.exists && !process.argv.includes("--force")) {
    console.log("\nAI Settings already exist in Firestore.");
    console.log("Run with --force to overwrite.");
    process.exit(0);
  }

  console.log("\nSeeding AI Settings to Firestore...");
  console.log("   Intents: " + DEFAULT_INTENTS.length);
  console.log("   Prompt Versions: 1");

  try {
    await docRef.set(settingsData);

    console.log("\n✅ Successfully seeded AI Settings to Firestore!");
    console.log("\n" + "-".repeat(60));
    console.log("Summary:");
    console.log("-".repeat(60));
    console.log("   Intents: " + DEFAULT_INTENTS.length);
    console.log("   Prompt Version: 1 (published)");
    console.log("   Settings: temple info, visitor info, policies, AI responses");
    console.log("\n" + "=".repeat(60));
  } catch (error) {
    console.error("\n❌ Error seeding data:", error);
    process.exit(1);
  }
}

seedAISettings();
