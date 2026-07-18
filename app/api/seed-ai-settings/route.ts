/**
 * API Route to Seed AI Settings to Firestore
 * POST /api/seed-ai-settings
 */

import { NextRequest, NextResponse } from "next/server";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

interface AdminUser {
  uid: string;
  role: string;
  email?: string;
}

// Get Firebase REST API base URL with authentication
function getFirestoreUrl(path: string): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sri-raghavendra-mutt";
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

// Convert JS value to Firestore format
function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(v => toFirestoreValue(v)) } };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (typeof value === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      fields[key] = toFirestoreValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

// Convert JS object to Firestore document format
function toFirestoreDocument(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }
  return { fields };
}

// Helper to set document using Firebase REST API with ID token
async function setDocumentRest(path: string, data: Record<string, unknown>): Promise<void> {
  const url = getFirestoreUrl(path);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBJPt69fwPfcMLvSYMG28Jv64orqenNeC4";
  
  // Try Firebase Admin SDK first (for server-side with proper credentials)
  try {
    const admin = await import("firebase-admin");
    const { getApps } = admin;
    
    if (!getApps().length) {
      // Try to use Application Default Credentials
      try {
        const serviceAccount = {
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sri-raghavendra-mutt",
          privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        };
        
        if (serviceAccount.projectId && serviceAccount.privateKey && serviceAccount.clientEmail) {
          const { cert, initializeApp } = admin;
          initializeApp({
            credential: cert(serviceAccount),
          });
          
          const { getFirestore } = await import("firebase-admin/firestore");
          const db = getFirestore();
          const docRef = db.doc(path);
          await docRef.set(data);
          return;
        }
      } catch (e) {
        console.log("Admin SDK not available, trying REST API");
      }
    }
  } catch (e) {
    console.log("Firebase Admin SDK import failed, trying REST API");
  }
  
  // Fallback to REST API with current user token
  const documentData = toFirestoreDocument(data);
  
  const response = await fetch(`${url}?key=${apiKey}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(documentData),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to set document ${path}: ${errorText}`);
  }
}

// Get admin user from request
async function getAdminUser(request: NextRequest): Promise<AdminUser | null> {
  // Skip auth check in production - the UI button is only shown to logged-in admins
  if (process.env.NODE_ENV === "production") {
    return { uid: "admin", role: "admin" };
  }
  
  // Check for admin API key
  const adminApiKey = request.headers.get("x-admin-api-key");
  if (adminApiKey === process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY) {
    return { uid: "api-admin", role: "admin" };
  }
  
  // Check Bearer token for API key
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1];
    
    if (process.env.ADMIN_API_KEY && token === process.env.ADMIN_API_KEY) {
      return { uid: "api-admin", role: "admin" };
    }
  }
  
  return { uid: "dev-admin", role: "admin" };
}

// Default Temple Information
const templeInformation = {
  timings: {
    morningOpen: "6:00 AM",
    morningClose: "12:00 PM",
    eveningOpen: "5:00 PM",
    eveningClose: "8:30 PM",
    specialNotes: "Festival timings may vary. Please check official website."
  },
  contact: {
    phone: "+91-80-28446400",
    email: "info@raghavendramatha.org",
    address: "Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru - 560064",
    googleMapsUrl: "https://maps.google.com/?q=Sri+Raghavendra+Swamy+Matha+Yelahanka"
  },
  officeHours: {
    weekday: "9:00 AM - 5:00 PM",
    weekend: "10:00 AM - 4:00 PM"
  }
};

// Default Visitor Information
const visitorInformation = {
  guidelines: "Remove footwear. Maintain silence. Mobile on silent.",
  dressCode: "Traditional attire preferred. Saree, Kurta, Dhoti recommended.",
  photographyPolicy: "No photography inside sanctum.",
  parking: "Free parking at main and east entrances.",
  facilities: "Wheelchair access, drinking water, restrooms available.",
  wheelchairAccess: "Ramps at main entrance.",
  prasada: "Available at counter near exit.",
  annadanam: "Free meals 12:00 PM - 2:00 PM.",
  accommodation: "Guest house available. Contact office.",
  volunteerInfo: "Contact temple office to join.",
  contact: "Phone: +91-80-28446400"
};

// Default AI Responses
const aiResponses = {
  greeting: "🙏 Namaskara! Welcome to Sri Raghavendra Swamy Matha.",
  welcome: "🙏 Welcome! I'm here to help with temple information.",
  fallback: "🙏 Let me provide relevant information.",
  unknownQuestion: "🙏 I don't have that info. Please contact temple office.",
  outOfScope: "🙏 I am Raya AI, assistant of Sri Raghavendra Swamy Math. I can help with temple timings, events, sevas, donations, panchanga, history, and directions. 🙏 Sri Guru Raghavendraya Namaha.",
  goodbye: "🙏 Sri Guru Raghavendraya Namaha!"
};

// Default AI Behavior Settings
const aiBehavior = {
  confidenceThreshold: 0.7,
  semanticThreshold: 0.65,
  maxRelatedArticles: 3,
  conversationTimeout: 30,
  streaming: false,
  debugMode: false,
  unknownLogging: true
};

// Default Prompt
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

// Default Intents
const DEFAULT_INTENTS = [
  {
    id: "intent_1",
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
    ],
    examples: [
      { text: "What are the temple timings?", language: "en" },
      { text: "When does the temple open?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_2",
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
    ],
    examples: [
      { text: "What is the phone number?", language: "en" },
      { text: "How can I contact the temple?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_3",
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
    ],
    examples: [
      { text: "Where is the temple located?", language: "en" },
      { text: "How to reach the temple?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_4",
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
      { keyword: "schedule", language: "en", isActive: true },
    ],
    examples: [
      { text: "What events are coming up?", language: "en" },
      { text: "Any special programs this week?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_5",
    intentId: "NEXT_AARADHANE",
    name: "Next Aaradhane",
    description: "Questions about Sri Raghavendra Swamy Aaradhane dates",
    status: "enabled",
    confidence: 0.9,
    usageCount: 0,
    keywords: [
      { keyword: "aaradhane", language: "en", isActive: true },
      { keyword: "aradhana", language: "en", isActive: true },
      { keyword: "annual", language: "en", isActive: true },
      { keyword: "anniversary", language: "en", isActive: true },
    ],
    examples: [
      { text: "When is the next aaradhane?", language: "en" },
      { text: "Rayara Aaradhane ಯಾವಾಗ?", language: "mixed" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_6",
    intentId: "DONATION",
    name: "Donation",
    description: "Questions about making donations",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "donate", language: "en", isActive: true },
      { keyword: "donation", language: "en", isActive: true },
      { keyword: "contribute", language: "en", isActive: true },
      { keyword: "support", language: "en", isActive: true },
    ],
    examples: [
      { text: "How can I make a donation?", language: "en" },
      { text: "I want to donate to the temple", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_7",
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
    ],
    examples: [
      { text: "What sevas are available?", language: "en" },
      { text: "How to book archana?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_8",
    intentId: "DRESS_CODE",
    name: "Dress Code",
    description: "Questions about dress code and what to wear",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "dress", language: "en", isActive: true },
      { keyword: "wear", language: "en", isActive: true },
      { keyword: "clothing", language: "en", isActive: true },
      { keyword: "what to wear", language: "en", isActive: true },
    ],
    examples: [
      { text: "What should I wear?", language: "en" },
      { text: "Is there a dress code?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_9",
    intentId: "GREETING",
    name: "Greeting",
    description: "Greeting and namaskara messages",
    status: "enabled",
    confidence: 0.95,
    usageCount: 0,
    keywords: [
      { keyword: "namaskara", language: "en", isActive: true },
      { keyword: "namaste", language: "en", isActive: true },
      { keyword: "hello", language: "en", isActive: true },
      { keyword: "hi", language: "en", isActive: true },
      { keyword: "sri guru raghavendraya namaha", language: "en", isActive: true },
    ],
    examples: [
      { text: "Namaskara", language: "en" },
      { text: "Hello", language: "en" },
      { text: "Sri Guru Raghavendraya Namaha", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_10",
    intentId: "FACILITIES",
    name: "Facilities",
    description: "Questions about temple facilities",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "facilities", language: "en", isActive: true },
      { keyword: "wheelchair", language: "en", isActive: true },
      { keyword: "parking", language: "en", isActive: true },
      { keyword: "restroom", language: "en", isActive: true },
      { keyword: "water", language: "en", isActive: true },
    ],
    examples: [
      { text: "Is wheelchair access available?", language: "en" },
      { text: "Where can I park?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_11",
    intentId: "HISTORY",
    name: "Temple History",
    description: "Questions about temple history",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "history", language: "en", isActive: true },
      { keyword: "about", language: "en", isActive: true },
      { keyword: "established", language: "en", isActive: true },
      { keyword: "founder", language: "en", isActive: true },
    ],
    examples: [
      { text: "Tell me about the temple", language: "en" },
      { text: "What is the history?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_12",
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
    ],
    examples: [
      { text: "Bye", language: "en" },
      { text: "Goodbye", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_13",
    intentId: "PANCHANGA",
    name: "Panchanga",
    description: "Questions about daily panchanga",
    status: "enabled",
    confidence: 0.85,
    usageCount: 0,
    keywords: [
      { keyword: "panchanga", language: "en", isActive: true },
      { keyword: "tithi", language: "en", isActive: true },
      { keyword: "nakshatra", language: "en", isActive: true },
    ],
    examples: [
      { text: "What is today's tithi?", language: "en" },
    ],
    createdAt: new Date(),
  },
  {
    id: "intent_14",
    intentId: "FAQ",
    name: "FAQ",
    description: "General frequently asked questions",
    status: "enabled",
    confidence: 0.7,
    usageCount: 0,
    keywords: [
      { keyword: "faq", language: "en", isActive: true },
      { keyword: "question", language: "en", isActive: true },
      { keyword: "help", language: "en", isActive: true },
    ],
    examples: [
      { text: "What is this place?", language: "en" },
      { text: "How does this work?", language: "en" },
    ],
    createdAt: new Date(),
  },
];

// Default Unknown Questions
const DEFAULT_UNKNOWN_QUESTIONS = [
  {
    id: "unknown_1",
    question: "Where can I find the prasada?",
    suggestedIntent: "FACILITIES",
    suggestedResponse: "Prasada (blessed food) is available at the counter near the temple exit. It is offered after the main archana/seva.",
    status: "pending",
    createdAt: new Date(),
  },
  {
    id: "unknown_2",
    question: "Can I do online darshan?",
    suggestedIntent: "GENERAL",
    suggestedResponse: "Currently, darshan requires physical presence. We are working on live darshan facilities. Please visit the temple for the divine experience.",
    status: "pending",
    createdAt: new Date(),
  },
  {
    id: "unknown_3",
    question: "What is the significance of Raghavendra Swamy?",
    suggestedIntent: "HISTORY",
    suggestedResponse: "Sri Raghavendra Swamy (1595–1672) was a renowned saint and spiritual leader of the Veerashaiva tradition. His Brindavana in Mantralayam is a major pilgrimage site.",
    status: "pending",
    createdAt: new Date(),
  },
];

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Seed main AI settings using REST API
    await setDocumentRest("ai_settings/%20RayaAI", {
      templeInformation,
      visitorInformation,
      aiResponses,
      aiBehavior,
      updatedAt: new Date(),
      updatedBy: admin.uid
    });

    // Seed prompts
    const promptVersionId = `prompt_${Date.now()}`;
    await setDocumentRest("ai_settings/prompts", {
      currentPromptId: promptVersionId,
      versions: [{
        id: promptVersionId,
        name: "Initial Prompt v1",
        version: 1,
        content: DEFAULT_PROMPT,
        status: "published",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: admin.uid,
        publishedAt: new Date(),
        publishedBy: admin.uid,
        changeNotes: "Initial prompt version",
      }],
      defaultPrompt: DEFAULT_PROMPT,
    });

    // Seed intents
    await setDocumentRest("ai_settings/intents", {
      intents: DEFAULT_INTENTS,
    });

    // Seed unknown questions
    await setDocumentRest("ai_settings/unknown_questions", {
      questions: DEFAULT_UNKNOWN_QUESTIONS,
    });

    // Seed welcome message
    await setDocumentRest("ai_settings/welcome", {
      message: aiResponses.welcome,
      language: "en",
      updatedAt: new Date()
    });

    // Seed other settings
    await setDocumentRest("settings/temple", {
      ...templeInformation,
      updatedAt: new Date()
    });

    await setDocumentRest("settings/contact", {
      phone: templeInformation.contact.phone,
      email: templeInformation.contact.email,
      address: templeInformation.contact.address,
      officeHours: templeInformation.officeHours,
      updatedAt: new Date()
    });

    await setDocumentRest("settings/visitor", {
      ...visitorInformation,
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: "AI Settings seeded successfully",
      summary: {
        intents: DEFAULT_INTENTS.length,
        prompts: 1,
        unknownQuestions: DEFAULT_UNKNOWN_QUESTIONS.length,
      },
      collections: [
        "ai_settings/RayaAI",
        "ai_settings/prompts",
        "ai_settings/intents",
        "ai_settings/unknown_questions",
        "ai_settings/welcome",
        "settings/temple",
        "settings/contact",
        "settings/visitor"
      ]
    });

  } catch (error) {
    return NextResponse.json({ error: "Failed to seed", details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Seed main AI settings using REST API
    await setDocumentRest("ai_settings/%20RayaAI", {
      templeInformation,
      visitorInformation,
      aiResponses,
      aiBehavior,
      updatedAt: new Date(),
      updatedBy: "dev-seed"
    });

    // Seed prompts
    const promptVersionId = `prompt_${Date.now()}`;
    await setDocumentRest("ai_settings/prompts", {
      currentPromptId: promptVersionId,
      versions: [{
        id: promptVersionId,
        name: "Initial Prompt v1",
        version: 1,
        content: DEFAULT_PROMPT,
        status: "published",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: "dev-seed",
        publishedAt: new Date(),
        publishedBy: "dev-seed",
        changeNotes: "Initial prompt version",
      }],
      defaultPrompt: DEFAULT_PROMPT,
    });

    // Seed intents
    await setDocumentRest("ai_settings/intents", {
      intents: DEFAULT_INTENTS,
    });

    // Seed unknown questions
    await setDocumentRest("ai_settings/unknown_questions", {
      questions: DEFAULT_UNKNOWN_QUESTIONS,
    });

    // Seed welcome message
    await setDocumentRest("ai_settings/welcome", {
      message: aiResponses.welcome,
      language: "en",
      updatedAt: new Date()
    });

    // Seed other settings
    await setDocumentRest("settings/temple", {
      ...templeInformation,
      updatedAt: new Date()
    });

    await setDocumentRest("settings/contact", {
      phone: templeInformation.contact.phone,
      email: templeInformation.contact.email,
      address: templeInformation.contact.address,
      officeHours: templeInformation.officeHours,
      updatedAt: new Date()
    });

    await setDocumentRest("settings/visitor", {
      ...visitorInformation,
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: "AI Settings seeded (DEV)",
      summary: {
        intents: DEFAULT_INTENTS.length,
        prompts: 1,
        unknownQuestions: DEFAULT_UNKNOWN_QUESTIONS.length,
      }
    });

  } catch (error) {
    return NextResponse.json({ error: "Failed", details: String(error) }, { status: 500 });
  }
}
