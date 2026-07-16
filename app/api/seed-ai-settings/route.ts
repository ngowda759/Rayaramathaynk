/**
 * API Route to Seed AI Settings to Firestore
 * POST /api/seed-ai-settings
 * 
 * Uses ADMIN_SECRET header for authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Simple auth check using secret header
function isAuthenticated(request: NextRequest): boolean {
  const secret = request.headers.get("x-admin-secret");
  return secret === process.env.ADMIN_SECRET;
}

// Check if Firestore is initialized
function checkFirestore() {
  if (!db) {
    throw new Error("Firestore is not initialized. Check environment variables.");
  }
  return db;
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

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const firestore = checkFirestore();

    await setDoc(doc(firestore, "ai_settings", " RayaAI"), {
      templeInformation,
      visitorInformation,
      aiResponses,
      aiBehavior,
      updatedAt: serverTimestamp(),
      updatedBy: "admin"
    });

    await setDoc(doc(firestore, "ai_settings", "welcome"), {
      message: aiResponses.welcome,
      language: "en",
      updatedAt: serverTimestamp()
    });

    await setDoc(doc(firestore, "settings", "temple"), {
      ...templeInformation,
      updatedAt: serverTimestamp()
    });

    await setDoc(doc(firestore, "settings", "contact"), {
      phone: templeInformation.contact.phone,
      email: templeInformation.contact.email,
      address: templeInformation.contact.address,
      officeHours: templeInformation.officeHours,
      updatedAt: serverTimestamp()
    });

    await setDoc(doc(firestore, "settings", "visitor"), {
      ...visitorInformation,
      updatedAt: serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: "AI Settings seeded",
      collections: ["ai_settings/RayaAI", "ai_settings/welcome", "settings/temple", "settings/contact", "settings/visitor"]
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
    const firestore = checkFirestore();

    await setDoc(doc(firestore, "ai_settings", " RayaAI"), {
      templeInformation,
      visitorInformation,
      aiResponses,
      aiBehavior,
      updatedAt: serverTimestamp(),
      updatedBy: "dev-seed"
    });

    await setDoc(doc(firestore, "ai_settings", "welcome"), {
      message: aiResponses.welcome,
      language: "en",
      updatedAt: serverTimestamp()
    });

    await setDoc(doc(firestore, "settings", "temple"), {
      ...templeInformation,
      updatedAt: serverTimestamp()
    });

    await setDoc(doc(firestore, "settings", "contact"), {
      phone: templeInformation.contact.phone,
      email: templeInformation.contact.email,
      address: templeInformation.contact.address,
      officeHours: templeInformation.officeHours,
      updatedAt: serverTimestamp()
    });

    await setDoc(doc(firestore, "settings", "visitor"), {
      ...visitorInformation,
      updatedAt: serverTimestamp()
    });

    return NextResponse.json({ success: true, message: "AI Settings seeded (DEV)" });

  } catch (error) {
    return NextResponse.json({ error: "Failed", details: String(error) }, { status: 500 });
  }
}
