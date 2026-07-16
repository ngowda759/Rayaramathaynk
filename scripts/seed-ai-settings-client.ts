/**
 * Seed AI Settings to Firestore (Client SDK Version)
 * Run this in browser console or create an API route to execute
 */

import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Default Temple Information
const templeInformation = {
  timings: {
    morningOpen: "6:00 AM",
    morningClose: "12:00 PM",
    eveningOpen: "5:00 PM",
    eveningClose: "8:30 PM",
    specialNotes: "Festival timings may vary. Please check official website for special occasions."
  },
  contact: {
    phone: "+91-80-28446400",
    email: "info@raghavendramatha.org",
    address: "Sri Raghavendra Swamy Matha, Yelahanka New Town, Bengaluru - 560064, Karnataka, India",
    googleMapsUrl: "https://maps.google.com/?q=Sri+Raghavendra+Swamy+Matha+Yelahanka"
  },
  officeHours: {
    weekday: "9:00 AM - 5:00 PM",
    weekend: "10:00 AM - 4:00 PM",
    notes: "Office closed on public holidays"
  }
};

// Default Visitor Information
const visitorInformation = {
  guidelines: "Remove footwear before entering. Maintain silence and decorum. Mobile phones on silent.",
  dressCode: "Traditional attire preferred. Saree, Kurta, Dhoti recommended. Avoid shorts and sleeveless.",
  photographyPolicy: "Photography not allowed inside sanctum. Flash prohibited.",
  parking: "Free parking at main and east entrances.",
  facilities: "Wheelchair access, drinking water, restrooms available.",
  wheelchairAccess: "Ramps at main entrance. Wheelchair available for borrowing.",
  drinkingWater: "RO water near entrance and Annadanam hall.",
  restrooms: "Available near entrance and Annadanam hall.",
  prasada: "Prasada available at counter near exit after darshan.",
  annadanam: "Free meals 12:00 PM - 2:00 PM. All welcome.",
  accommodation: "Guest house available. Contact office for booking.",
  volunteerInfo: "Contact temple office to join volunteer program.",
  testimonials: "Share your spiritual experience at the temple.",
  contact: "Phone: +91-80-28446400, Email: info@raghavendramatha.org"
};

// Default Temple Policies
const templePolicies = {
  donations: "Donations welcome. Bank transfers and UPI accepted.",
  information80G: "80G tax exemption available. Contact office for certificate.",
  sevaBooking: "Special sevas can be booked online or at temple counter.",
  onlineServices: "Online donations and seva booking available on temple website.",
  childrenPolicy: "Children welcome. Supervision required for young children.",
  queueGuidelines: "Special queues for senior citizens and differently-abled."
};

// Default AI Responses
const aiResponses = {
  greeting: "🙏 Namaskara! Welcome to Sri Raghavendra Swamy Matha. How may I help you?",
  welcome: "🙏 Welcome! I'm here to help with temple information, darshan timings, sevas, and more.",
  fallback: "🙏 Let me provide you with the most relevant information I have.",
  unknownQuestion: "🙏 I don't have specific information about that. Please contact the temple office.",
  outOfScope: "🙏 I am Raya AI, the official assistant of Sri Raghavendra Swamy Math. I can help with temple timings, events, sevas, donations, panchanga, and more. Please contact temple office for other queries. 🙏 Sri Guru Raghavendraya Namaha.",
  goodbye: "🙏 Sri Guru Raghavendraya Namaha! Thank you for connecting. Jai Sri Gurudev!"
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

// Main seed function
export async function seedAISettings() {
  console.log("🚀 Starting AI Settings seed...");

  try {
    // Seed AI Settings document
    await setDoc(doc(db, "ai_settings", " RayaAI"), {
      templeInformation,
      visitorInformation,
      templePolicies,
      aiResponses,
      aiBehavior,
      updatedAt: serverTimestamp()
    });
    console.log("✅ Seeded: ai_settings/RayaAI");

    // Seed AI Welcome Message
    await setDoc(doc(db, "ai_settings", "welcome"), {
      message: aiResponses.welcome,
      language: "en",
      updatedAt: serverTimestamp()
    });
    console.log("✅ Seeded: ai_settings/welcome");

    // Seed Temple Information (legacy)
    await setDoc(doc(db, "settings", "temple"), {
      ...templeInformation,
      updatedAt: serverTimestamp()
    });
    console.log("✅ Seeded: settings/temple");

    // Seed Contact Information (legacy)
    await setDoc(doc(db, "settings", "contact"), {
      phone: templeInformation.contact.phone,
      email: templeInformation.contact.email,
      address: templeInformation.contact.address,
      officeHours: templeInformation.officeHours,
      updatedAt: serverTimestamp()
    });
    console.log("✅ Seeded: settings/contact");

    // Seed Visitor Guidelines (legacy)
    await setDoc(doc(db, "settings", "visitor"), {
      ...visitorInformation,
      updatedAt: serverTimestamp()
    });
    console.log("✅ Seeded: settings/visitor");

    console.log("\n✨ AI Settings seeded successfully!");
    return { success: true };

  } catch (error) {
    console.error("❌ Error seeding AI settings:", error);
    return { success: false, error };
  }
}

// Export for use in browser console
if (typeof window !== "undefined") {
  (window as any).seedAISettings = seedAISettings;
}
