/**
 * Seed AI Settings to Firestore
 * This script populates the AI Management Center settings in Firestore
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase-admin/firestore";

// Firebase Admin initialization
function initFirebase() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      : null;

    if (!serviceAccount) {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required");
      process.exit(1);
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return getFirestore();
}

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
  guidelines: `Remove footwear before entering the sanctum.
Maintain silence and decorum inside the temple.
Stand respectfully during archana and aarti.
Mobile phones should be on silent mode.
Do not enter during archana if in progress.
Accept prasada with both hands.`,
  dressCode: `Traditional Indian attire is preferred.
Saree, Kurta, Dhoti for men and women recommended.
Avoid shorts, sleeveless tops, and revealing clothing.
Head covered is appreciated (especially for women).
Remove leather items before entering.`,
  photographyPolicy: `Photography not allowed inside the sanctum sanctorum.
Flash photography is strictly prohibited.
External photography allowed in the temple premises.
Videography requires prior permission.`,
  parking: `Free parking available at main entrance.
Additional parking at east entrance.
Two-wheeler parking near gate no. 1.
Parking available for differently-abled near entrance.`,
  facilities: `Wheelchair access available at main entrance.
Drinking water (RO) near entrance.
Restrooms near entrance and Annadanam hall.
First aid facility available.`,
  wheelchairAccess: `Ramps available at main entrance.
Wheelchair available for borrowing at entrance.
Assistance available on request.
Designated parking for differently-abled.`,
  drinkingWater: `RO water dispensers near temple entrance.
Water available near Annadanam hall.
Carry your own water bottle recommended during summer.`,
  restrooms: `Clean restrooms available near main entrance.
Restrooms near Annadanam hall.
 wheelchair-accessible restrooms available.`,
  prasada: `Prasada (blessed offering) available at counter.
Commonly available: Tamboola (betel leaf), coconut.
Prasada distribution after darshan.`,
  annadanam: `Free meals (Annadanam) available at designated hall.
Timings: 12:00 PM - 2:00 PM (subject to change).
All are welcome regardless of background.`,
  accommodation: `Guest house available for devotees.
Contact office for booking and availability.
Advance booking recommended during festivals.`,
  volunteerInfo: `Volunteers welcome for various services.
Contact temple office to join volunteer program.
Training provided for sevadars.`,
  testimonials: `Share your spiritual experience at the temple.
Your testimonials inspire other devotees.
Submit via temple website or suggestion box.`,
  contact: `Phone: +91-80-28446400
Email: info@raghavendramatha.org
Available during office hours.`
};

// Default Temple Policies
const templePolicies = {
  donations: `Donations are welcome and help support temple operations.
Bank transfers and UPI payments accepted.
All donations contribute to temple maintenance and charity.
Contact office for donation purposes.`,
  information80G: `80G tax exemption available for donations.
Donation receipts provided for tax purposes.
Contact office for 80G certificate.`,
  sevaBooking: `Special sevas can be booked online or at temple counter.
Advance booking recommended for special sevas.
Archana, Abhisheka, and other sevas available.`,
  onlineServices: `Online donations available on temple website.
Seva booking online via temple portal.
Darshan booking available during peak seasons.`,
  childrenPolicy: `Children welcome at the temple.
Supervision required for young children.
Special facilities during festivals.
Stroller parking available.`,
  queueGuidelines: `Special queues for senior citizens and differently-abled.
General darshan queue available.
Fast-track queue during weekdays mornings.`
};

// Default AI Responses
const aiResponses = {
  greeting: "🙏 Namaskara! Welcome to Sri Raghavendra Swamy Matha. I am Raya AI, your assistant. How may I help you today?",
  welcome: "🙏 Welcome! I'm here to help with temple information, darshan timings, sevas, donations, and more. Please ask your question.",
  fallback: "🙏 Let me provide you with the most relevant information I have. Please contact the temple office for detailed queries.",
  unknownQuestion: "🙏 I don't have specific information about that. Could you rephrase your question or contact the temple office for assistance?",
  outOfScope: `🙏 Namaskara! I am **Raya AI**, the official assistant of Sri Raghavendra Swamy Math.

I can help you with:
• 🕐 Temple timings and schedule
• 📅 Events and festivals
• 🙏 Sevas and services
• 💝 Donations and contributions
• 📿 Panchanga information
• 📖 Temple history and philosophy
• 📍 Location and directions
• ❓ Frequently asked questions

For other queries, please contact the temple office directly.

🙏 Sri Guru Raghavendraya Namaha.`,
  goodbye: "🙏 Sri Guru Raghavendraya Namaha! Thank you for connecting. Please feel free to return anytime. Jai Sri Gurudev!"
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

// Default System Prompt
const systemPrompt = `You are Raya AI, the official chatbot assistant of Sri Raghavendra Swamy Matha, Yelahanka, Bengaluru.

Your role is to help devotees with:
1. Temple timings and darshan schedules
2. Information about sevas (Archana, Abhisheka, etc.)
3. Donation queries (including 80G certificates)
4. Upcoming events and festivals
5. Panchanga (daily almanac) information
6. Temple history and Sri Raghavendra Swamy's teachings
7. Visitor guidelines and facilities
8. Contact information

Guidelines:
- Always respond with respect and devotion
- Use Namaskara and Sri Guru Raghavendraya Namaha appropriately
- Provide accurate information from the knowledge base
- For uncertain queries, recommend contacting the temple office
- Never fabricate temple facts or timings
- Keep responses concise but informative
- Support both English and Kannada languages

Temple Details:
- Location: Yelahanka New Town, Bengaluru, Karnataka
- Main Deity: Sri Raghavendra Swamy
- Philosophy: Dvaita Vedanta (Madhwa tradition)
- Established: To serve devotees in northern Bengaluru

Be helpful, respectful, and devotional in all interactions.`;

// Main seed function
async function seedAIsettings() {
  console.log("🚀 Starting AI Settings seed...\n");

  const db = initFirebase();

  try {
    // Seed AI Settings document
    const aiSettingsRef = doc(db, "ai_settings", " RayaAI");
    await setDoc(aiSettingsRef, {
      templeInformation,
      visitorInformation,
      templePolicies,
      aiResponses,
      aiBehavior,
      updatedAt: Timestamp.now(),
      updatedBy: "system-seed"
    });
    console.log("✅ Seeded: ai_settings/RayaAI");

    // Seed AI Welcome Message
    const welcomeRef = doc(db, "ai_settings", "welcome");
    await setDoc(welcomeRef, {
      message: aiResponses.welcome,
      language: "en",
      updatedAt: Timestamp.now()
    });
    console.log("✅ Seeded: ai_settings/welcome");

    // Seed AI System Prompt
    const promptRef = doc(db, "ai_settings", "prompt");
    await setDoc(promptRef, {
      content: systemPrompt,
      version: 1,
      updatedAt: Timestamp.now()
    });
    console.log("✅ Seeded: ai_settings/prompt");

    // Seed Temple Information (legacy)
    const templeRef = doc(db, "settings", "temple");
    await setDoc(templeRef, {
      ...templeInformation,
      updatedAt: Timestamp.now()
    });
    console.log("✅ Seeded: settings/temple");

    // Seed Contact Information (legacy)
    const contactRef = doc(db, "settings", "contact");
    await setDoc(contactRef, {
      ...templeInformation.contact,
      officeHours: templeInformation.officeHours,
      updatedAt: Timestamp.now()
    });
    console.log("✅ Seeded: settings/contact");

    // Seed Visitor Guidelines (legacy)
    const visitorRef = doc(db, "settings", "visitor");
    await setDoc(visitorRef, {
      ...visitorInformation,
      updatedAt: Timestamp.now()
    });
    console.log("✅ Seeded: settings/visitor");

    console.log("\n✨ AI Settings seeded successfully!");
    console.log("\n📋 Collections updated:");
    console.log("   - ai_settings/RayaAI (comprehensive settings)");
    console.log("   - ai_settings/welcome (welcome message)");
    console.log("   - ai_settings/prompt (system prompt)");
    console.log("   - settings/temple (temple info)");
    console.log("   - settings/contact (contact info)");
    console.log("   - settings/visitor (visitor info)");

  } catch (error) {
    console.error("❌ Error seeding AI settings:", error);
    process.exit(1);
  }
}

// Run if called directly
seedAIsettings().catch(console.error);

export { seedAIsettings, templeInformation, visitorInformation, templePolicies, aiResponses, aiBehavior, systemPrompt };
