import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { AIMessage, DetectedLanguage } from "@/types/ai";
import { containsKannada } from "./languageDetector";

// Temple information stored in Firebase
export interface TempleInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  timings: {
    morning: { open: string; close: string };
    evening: { open: string; close: string };
  };
  upcomingEvents: Array<{
    title: string;
    date: Date;
    description?: string;
  }>;
  sevas: Array<{
    name: string;
    description: string;
    price?: string;
  }>;
  trustMembers: Array<{
    name: string;
    role: string;
  }>;
}

// Chat training data from Firebase
export interface ChatTrainingData {
  id: string;
  keywords: string[];
  response: string;
  category: string;
  priority: number;
  active: boolean;
}

// Cache for training data
let cachedTrainingData: ChatTrainingData[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get temple info from Firebase
export async function getTempleInfo(): Promise<TempleInfo | null> {
  if (!isFirebaseConfigured() || !db) {
    return null;
  }

  try {
    const info: TempleInfo = {
      name: "Sri Raghavendra Swamy Matha",
      address: "Yelahanka New Town, Bengaluru, Karnataka",
      phone: "+91 80 2332 3456",
      email: "ngowda759@gmail.com",
      timings: {
        morning: { open: "06:00 AM", close: "12:00 PM" },
        evening: { open: "05:00 PM", close: "08:30 PM" },
      },
      upcomingEvents: [],
      sevas: [],
      trustMembers: [],
    };

    // Get upcoming events
    try {
      const eventsQuery = query(
        collection(db, "events"),
        where("published", "==", true),
        orderBy("startDate", "asc"),
        limit(5)
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      
      eventsSnapshot.forEach((doc) => {
        const data = doc.data();
        let eventDate = data.startDate;
        
        // Handle Firebase timestamp
        if (eventDate && typeof eventDate.toDate === "function") {
          eventDate = eventDate.toDate();
        }
        
        info.upcomingEvents.push({
          title: data.title || "Event",
          date: eventDate instanceof Date ? eventDate : new Date(eventDate),
          description: data.description || "",
        });
      });
    } catch (e) {
      // Events collection might not exist or have no data
      console.log("[FirebaseChat] Could not fetch events");
    }

    // Get sevas
    try {
      const sevasSnapshot = await getDocs(collection(db, "sevas"));
      sevasSnapshot.forEach((doc) => {
        const data = doc.data();
        info.sevas.push({
          name: data.name || "Seva",
          description: data.description || "",
          price: data.price || data.amount || "",
        });
      });
    } catch (e) {
      console.log("[FirebaseChat] Could not fetch sevas");
    }

    // Get trust members
    try {
      const trustSnapshot = await getDocs(collection(db, "trust"));
      trustSnapshot.forEach((doc) => {
        const data = doc.data();
        info.trustMembers.push({
          name: data.name || "",
          role: data.role || data.position || "",
        });
      });
    } catch (e) {
      console.log("[FirebaseChat] Could not fetch trust members");
    }

    return info;
  } catch (error) {
    console.error("[FirebaseChat] Error fetching temple info:", error);
    return null;
  }
}

// Get training data from Firebase
export async function getTrainingData(): Promise<ChatTrainingData[]> {
  // Check cache first
  if (cachedTrainingData && Date.now() - lastFetchTime < CACHE_DURATION) {
    return cachedTrainingData;
  }

  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  try {
    const snapshot = await getDocs(
      query(
        collection(db, "chatTraining"),
        where("active", "==", true),
        orderBy("priority", "asc")
      )
    );

    cachedTrainingData = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChatTrainingData[];

    lastFetchTime = Date.now();
    return cachedTrainingData || [];
  } catch (error) {
    console.error("[FirebaseChat] Error fetching training data:", error);
    return cachedTrainingData || [];
  }
}

// Clear training data cache (useful when admin updates data)
export function clearTrainingDataCache() {
  cachedTrainingData = null;
  lastFetchTime = 0;
}

// Find matching training data for user message
function findMatchingTraining(
  userMessage: string,
  trainingData: ChatTrainingData[]
): ChatTrainingData | null {
  const message = userMessage.toLowerCase();
  
  // Sort by priority (1 = highest)
  const sorted = [...trainingData].sort((a, b) => a.priority - b.priority);
  
  for (const item of sorted) {
    // Check if any keyword matches
    for (const keyword of item.keywords) {
      if (message.includes(keyword.toLowerCase())) {
        return item;
      }
    }
  }
  
  return null;
}

// Generate response based on user message with language support
export async function generateFirebaseResponse(
  userMessage: string,
  templeInfo: TempleInfo | null,
  detectedLanguage: DetectedLanguage = "en"
): Promise<AIMessage> {
  const message = userMessage.toLowerCase();
  const hasKannada = containsKannada(userMessage);
  
  // Determine if we should respond in Kannada
  const useKannada = hasKannada || detectedLanguage === "kn" || detectedLanguage === "mixed";
  const useMixed = detectedLanguage === "mixed";

  // Try to find matching training data first
  const trainingData = await getTrainingData();
  const matched = findMatchingTraining(userMessage, trainingData);
  
  if (matched) {
    console.log("[FirebaseChat] Using training data match:", matched.category);
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: matched.response,
      timestamp: Date.now(),
    };
  }

  // Default temple info if Firebase not available
  const info = templeInfo || {
    name: "Sri Raghavendra Swamy Matha",
    address: "Yelahanka New Town, Bengaluru",
    phone: "+91 80 2332 3456",
    email: "ngowda759@gmail.com",
    timings: {
      morning: { open: "06:00 AM", close: "12:00 PM" },
      evening: { open: "05:00 PM", close: "08:30 PM" },
    },
    upcomingEvents: [],
    sevas: [
      { name: "Daily Pooja", description: "Regular pooja services" },
      { name: "Special Sevas", description: "Special pooja services on request" },
    ],
    trustMembers: [],
  };

  // Response generators for common queries - with Kannada support
  if (message.includes("location") || message.includes("where") || message.includes("address") || (message.includes("temple") && message.includes("locat"))) {
    const englishContent = `📍 **Temple Location**

**Sri Raghavendra Swamy Matha**
Yelahanka New Town
Bengaluru, Karnataka, India

**Contact:**
📞 ${info.phone}
📧 ${info.email}

🙏 We are located in the peaceful Yelahanka New Town area of Bengaluru. The temple is easily accessible by road and public transportation.

For directions, you can search for "Sri Raghavendra Swamy Matha Yelahanka" on Google Maps.

We look forward to welcoming you!`;

    const kannadaContent = `📍 **ದೇವಸ್ಥಾನದ ಸ್ಥಳ**

**ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ**
ಯಲಹಂಕ ನ್ಯೂ ಟೌನ್
ಬೆಂಗಳೂರು, ಕರ್ನಾಟಕ, ಭಾರತ

**ಸಂಪರ್ಕ:**
📞 ${info.phone}
📧 ${info.email}

🙏 ನಾವು ಬೆಂಗಳೂರಿನ ಶಾಂತಿಯುತ ಯಲಹಂಕ ನ್ಯೂ ಟೌನ್ ಪ್ರದೇಶದಲ್ಲಿದ್ದೇವೆ. ದೇವಸ್ಥಾನವು ರಸ್ತೆ ಮತ್ತು ಸಾರ್ವಜನಿಕ ಸಾರಿಗೆಯಿಂದ ಸುಲಭವಾಗಿ ತಲುಪಬಹುದಾಗಿದೆ.

ದಿಕ್ಕಿಗಾಗಿ ನೀವು Google Maps ನಲ್ಲಿ "Sri Raghavendra Swamy Matha Yelahanka" ಅನ್ನು ಹುಡುಕಬಹುದು.

ನಿಮ್ಮನ್ನು ಸ್ವಾಗತಿಸಲು ನಾವು ಎದುರು ನೋಡುತ್ತಿದ್ದೇವೆ!`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaContent : englishContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("timing") || message.includes("open") || message.includes("hour")) {
    const englishContent = `🕐 **Temple Timings**

**Morning:** ${info.timings.morning.open} - ${info.timings.morning.close}
**Evening:** ${info.timings.evening.open} - ${info.timings.evening.close}

🙏 Please note: Special timings apply during festivals and special occasions.

For the most accurate information, please contact the temple office.`;

    const kannadaContent = `🕐 **ದೇವಸ್ಥಾನದ ಸಮಯ**

**ಬೆಳಗಿನ ಸಮಯ:** ${info.timings.morning.open} - ${info.timings.morning.close}
**ಸಂಜೆಯ ಸಮಯ:** ${info.timings.evening.open} - ${info.timings.evening.close}

🙏 ದಯವಿಟ್ಟು ಗಮನಿಸಿ: ಹಬ್ಬಗಳು ಮತ್ತು ವಿಶೇಷ ಸಂದರ್ಭಗಳಲ್ಲಿ ವಿಶೇಷ ಸಮಯಗಳು ಅನ್ವಯವಾಗುತ್ತವೆ.

ಅತ್ಯಂತ ನಿಖರವಾದ ಮಾಹಿತಿಗಾಗಿ ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaContent : englishContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("event") || message.includes("festival") || message.includes("upcoming") || message.includes("ಹಬ್ಬ")) {
    const englishEventsContent = info.upcomingEvents.length > 0
      ? `📅 **Upcoming Events**

${info.upcomingEvents
  .map((e) => `• **${e.title}** - ${e.date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`)
  .join("\n")}

🙏 We welcome all devotees to participate in these sacred celebrations!

For more details, please visit our Events page or contact the temple office.`
      : `📅 **Upcoming Events**

Currently, there are no upcoming events scheduled on our website. However, we regularly hold:

• Daily poojas
• Ekadashi fasting and celebrations  
• Sri Raghavendra Jayanthi
• Bramhotsavam

🙏 For the latest updates, please check our Events page or contact the temple office directly.`;

    const kannadaEventsContent = `📅 **ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು**

ಪ್ರಸ್ತುತ ನಮ್ಮ ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಯಾವುದೇ ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳಿಲ್ಲ. ಆದರೆ ನಾವು ನಿಯಮಿತವಾಗಿ ನಡೆಸುತ್ತೇವೆ:

• ದೈನಿಕ ಪೂಜೆಗಳು
• ಏಕಾದಶಿ ಉಪವಾಸ ಮತ್ತು ಆಚರಣೆಗಳು  
• ಶ್ರೀ ರಾಘವೇಂದ್ರ ಜಯಂತಿ
• ಬ್ರಹ್ಮೋತ್ಸವ

🙏 ಇತ್ತೀಚಿನ ನವೀಕರಣಗಳಿಗಾಗಿ ದಯವಿಟ್ಟು ನಮ್ಮ ಕಾರ್ಯಕ್ರಮಗಳ ಪುಟವನ್ನು ಪರಿಶೀಲಿಸಿ ಅಥವಾ ನೇರವಾಗಿ ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaEventsContent : englishEventsContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("seva") || message.includes("service") || message.includes("pooja") || message.includes("ಸೇವೆ") || message.includes("ಪೂಜೆ")) {
    const englishSevaContent = info.sevas.length > 0
      ? `🙏 **Sevas Available**

${info.sevas
  .map((s) => `• **${s.name}**${s.price ? ` - ${s.price}` : ""}\n  ${s.description}`)
  .join("\n\n")}

🙏 To book a seva or for more information, please visit the Sevas page or contact the temple office.`
      : `🙏 **Temple Sevas**

We offer various sevas including:

• **Daily Pooja** - Morning and evening services
• **Suptharadhana** - Special offerings
• **Maha Pooja** - Grand pooja ceremonies
• **Astothram** - 108 names recitation
• **Archana** - Personal poojas

🙏 For bookings and inquiries, please visit our Sevas page or contact the temple office.`;

    const kannadaSevaContent = `🙏 **ಲಭ್ಯ ಸೇವೆಗಳು**

ನಾವು ವಿವಿಧ ಸೇವೆಗಳನ್ನು ಒದಗಿಸುತ್ತೇವೆ:

• **ದೈನಿಕ ಪೂಜೆ** - ಬೆಳಗು ಮತ್ತು ಸಂಜೆ ಸೇವೆಗಳು
• **ಸುಪ್ತರಧನ** - ವಿಶೇಷ ಕಾಣಿಕೆಗಳು
• **ಮಹಾ ಪೂಜೆ** - ದೊಡ್ಡ ಪೂಜಾ ವಿಧಿಗಳು
• **ಅಷ್ಟೋತ್ರ** - 108 ಹೆಸರುಗಳ ಪಾರಾಯಣ
• **ಅರ್ಚನೆ** - ವೈಯಕ್ತಿಕ ಪೂಜೆಗಳು

🙏 ಬುಕಿಂಗ್‌ಗಳು ಮತ್ತು ವಿಚಾರಣೆಗಳಿಗಾಗಿ ದಯವಿಟ್ಟು ನಮ್ಮ ಸೇವೆಗಳ ಪುಟವನ್ನು ಭೇಟಿ ಮಾಡಿ ಅಥವಾ ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaSevaContent : englishSevaContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("donat") || message.includes("contribute") || message.includes("ಕೊಡು")) {
    const englishDonateContent = `💝 **Donations & Contributions**

Your generous donations help us maintain the temple and continue our services.

**Ways to Donate:**
• Visit our Donation page on the website
• Contact the temple office for bank transfer details
• Donate in person at the temple

🙏 Every contribution, big or small, is deeply appreciated and goes towards maintaining the sacred space and services.

**Bank Details:**
For wire transfers, please contact the temple office for current bank information.`;

    const kannadaDonateContent = `💝 **ದೇಣಗಳು ಮತ್ತು ಕೊಡುಗೆಗಳು**

ನಿಮ್ಮ ಉದಾರ ದಾನಗಳು ದೇವಸ್ಥಾನವನ್ನು ನಿರ್ವಹಿಸಲು ಮತ್ತು ನಮ್ಮ ಸೇವೆಗಳನ್ನು ಮುಂದುವರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತವೆ.

**ದಾನ ಮಾಡಲು ವಿಧಾನಗಳು:**
• ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ನಮ್ಮ ದಾನ ಪುಟವನ್ನು ಭೇಟಿ ಮಾಡಿ
• ಬ್ಯಾಂಕ್ ವರ್ಗಾವಣೆ ವಿವರಗಳಿಗಾಗಿ ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ
• ದೇವಸ್ಥಾನದಲ್ಲಿ ವೈಯಕ್ತಿಕವಾಗಿ ದಾನ ಮಾಡಿ

🙏 ಪ್ರತಿಯೊಂದು ಕೊಡುಗೆ, ದೊಡ್ಡದಾಗಲಿ ಚಿಕ್ಕದಾಗಲಿ, ಗೌರವಯುತವಾಗಿ ಮೆಚ್ಚುತ್ತೇವೆ ಮತ್ತು ಪವಿತ್ರ ಸ್ಥಳವನ್ನು ನಿರ್ವಹಿಸುವುದಕ್ಕೆ ಮತ್ತು ಸೇವೆಗಳನ್ನು ಮುಂದುವರಿಸುವುದಕ್ಕೆ ಬಳಸಲಾಗುತ್ತದೆ.`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaDonateContent : englishDonateContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("trust") || message.includes("committee") || message.includes("member")) {
    const englishTrustContent = info.trustMembers.length > 0
      ? `👥 **Trust Committee**

${info.trustMembers
  .map((m) => `• **${m.name}** - ${m.role}`)
  .join("\n")}

🙏 For any official matters, please contact the trust committee through the temple office.`
      : `👥 **Trust Committee**

Our trust committee manages the temple operations and spiritual activities. For information about current members and their roles, please contact the temple office directly.

🙏 We welcome devotees to participate in temple activities and volunteer for various services.`;

    const kannadaTrustContent = `👥 **ಟ್ರಸ್ಟ್ ಸಮಿತಿ**

ನಮ್ಮ ಟ್ರಸ್ಟ್ ಸಮಿತಿಯು ದೇವಸ್ಥಾನದ ಕಾರ್ಯಾಚರಣೆಗಳು ಮತ್ತು ಆಧ್ಯಾತ್ಮಿಕ ಚಟುವಟಿಕೆಗಳನ್ನು ನಿರ್ವಹಿಸುತ್ತದೆ. ಪ್ರಸ್ತುತ ಸದಸ್ಯರ ಮಾಹಿತಿಗಾಗಿ ದಯವಿಟ್ಟು ನೇರವಾಗಿ ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.

🙏 ದೇವಸ್ಥಾನದ ಚಟುವಟಿಕೆಗಳಲ್ಲಿ ಭಾಗವಹಿಸಲು ಮತ್ತು ವಿವಿಧ ಸೇವೆಗಳಿಗೆ ಸ್ಯಾಂಪಂದನಾ ಮಾಡಲು ಭಕ್ತರನ್ನು ಸ್ವಾಗತಿಸುತ್ತೇವೆ.`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaTrustContent : englishTrustContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("contact") || message.includes("phone") || message.includes("email") || message.includes("address") || message.includes("ಸಂಪರ್ಕ")) {
    const englishContactContent = `📞 **Contact Information**

**Sri Raghavendra Swamy Matha**
${info.address}

**Phone:** ${info.phone}
**Email:** ${info.email}

🙏 We welcome your calls and visits during temple hours. Please note that office hours may vary.`;

    const kannadaContactContent = `📞 **ಸಂಪರ್ಕ ಮಾಹಿತಿ**

**ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ**
${info.address}

**ಫೋನ್:** ${info.phone}
**ಇಮೇಲ್:** ${info.email}

🙏 ದೇವಸ್ಥಾನದ ಸಮಯದಲ್ಲಿ ನಿಮ್ಮ ಕರೆಗಳನ್ನು ಮತ್ತು ಭೇಟಿಗಳನ್ನು ಸ್ವಾಗತಿಸುತ್ತೇವೆ. ದಯವಿಟ್ಟು ಗಮನಿಸಿ ಕಛೇರಿಯ ಸಮಯಗಳು ಬದಲಾಗಬಹುದು.`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaContactContent : englishContactContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("gallery") || message.includes("photo") || message.includes("ಗ್ಯಾಲರಿ")) {
    const englishGalleryContent = `📸 **Temple Gallery**

Visit our Gallery page to see beautiful images of:

• Temple architecture and deity
• Festival celebrations
• Daily poojas
• Annadanam (food donation) services
• Utsavam (festivals)

🙏 Each image captures the divine atmosphere and devotion at our matha. We invite you to visit us in person to experience the spiritual bliss!`;

    const kannadaGalleryContent = `📸 **ದೇವಸ್ಥಾನದ ಗ್ಯಾಲರಿ**

ನಮ್ಮ ಗ್ಯಾಲರಿ ಪುಟವನ್ನು ಭೇಟಿ ಮಾಡಿ ಇವುಗಳ ಸುಂದರ ಚಿತ್ರಗಳನ್ನು ನೋಡಿ:

• ದೇವಸ್ಥಾನದ ವಾಸ್ತುಶಿಲ್ಪ ಮತ್ತು ಮೂರ್ತಿ
• ಹಬ್ಬದ ಆಚರಣೆಗಳು
• ದೈನಿಕ ಪೂಜೆಗಳು
• ಅನ್ನದಾನ ಸೇವೆಗಳು
• ಉತ್ಸವಗಳು

🙏 ಪ್ರತಿಯೊಂದು ಚಿತ್ರವು ನಮ್ಮ ಮಠದ ದೈವಿಕ ವಾತಾವರಣ ಮತ್ತು ಭಕ್ತಿಯನ್ನು ಸೆರೆಹಿಡಿಯುತ್ತದೆ. ಆಧ್ಯಾತ್ಮಿಕ ಆನಂದವನ್ನು ಅನುಭವಿಸಲು ನಾವು ನಿಮ್ಮನ್ನು ವೈಯಕ್ತಿಕವಾಗಿ ಭೇಟಿ ಮಾಡಲು ಆಹ್ವಾನಿಸುತ್ತೇವೆ!`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaGalleryContent : englishGalleryContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("volunteer") || message.includes("sevaka") || message.includes("ಸ್ಯಾಂಪಂದನಾ")) {
    const englishVolunteerContent = `🤝 **Volunteer Opportunities**

We welcome devotees who wish to serve the temple!

**Ways to Volunteer:**
• Help during daily poojas
• Assist in festival preparations
• Participate in Annadanam (food service)
• Guide visitors and devotees
• Help with temple maintenance

🙏 To express your interest in volunteering, please contact the temple office or speak with a priest during your visit.

Your service is considered a sacred karma (duty) and will be richly blessed!`;

    const kannadaVolunteerContent = `🤝 **ಸ್ಯಾಂಪಂದನಾ ಅವಕಾಶಗಳು**

ದೇವಸ್ಥಾನಕ್ಕೆ ಸೇವೆ ಮಾಡಲು ಬಯಸುವ ಭಕ್ತರನ್ನು ನಾವು ಸ್ವಾಗತಿಸುತ್ತೇವೆ!

**ಸ್ಯಾಂಪಂದನಾ ಮಾಡಲು ವಿಧಾನಗಳು:**
• ದೈನಿಕ ಪೂಜೆಗಳ ಸಮಯದಲ್ಲಿ ಸಹಾಯ ಮಾಡಿ
• ಹಬ್ಬದ ತಯಾರಿಗಳಲ್ಲಿ ಸಹಾಯ ಮಾಡಿ
• ಅನ್ನದಾನ (ಆಹಾರ ಸೇವೆ)ಯಲ್ಲಿ ಭಾಗವಹಿಸಿ
• ಭೇಟಿದಾರರನ್ನು ಮತ್ತು ಭಕ್ತರನ್ನು ಮಾರ್ಗದರ್ಶನ ಮಾಡಿ
• ದೇವಸ್ಥಾನದ ನಿರ್ವಹಣೆಯಲ್ಲಿ ಸಹಾಯ ಮಾಡಿ

🙏 ಸ್ಯಾಂಪಂದನಾ ಮಾಡಲು ನಿಮ್ಮ ಆಸಕ್ತಿಯನ್ನು ವ್ಯಕ್ತಪಡಿಸಲು, ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ ಅಥವಾ ಭೇಟಿಯ ಸಮಯದಲ್ಲಿ ಅರ್ಚಕರೊಂದಿಗೆ ಮಾತನಾಡಿ.

ನಿಮ್ಮ ಸೇವೆಯು ಪವಿತ್ರ ಕರ್ಮ (ಕರ್ತವ್ಯ) ಎಂದು ಪರಿಗಣಿಸಲಾಗುತ್ತದೆ ಮತ್ತು ಶ್ರೀಮಂತವಾಗಿ ಆಶೀರ್ವದಿಸಲಾಗುತ್ತದೆ!`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaVolunteerContent : englishVolunteerContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("testimonial") || message.includes("share experience") || message.includes("feedback") || message.includes("review")) {
    const englishTestimonialContent = `✨ **Share Your Temple Experience**

We would love to hear about your spiritual journey and experiences at Sri Raghavendra Swamy Matha!

**How to Share Your Testimonial:**
• Visit our website's Testimonials page
• Fill in your name, city, and your experience
• Rate your visit (1-5 stars)
• Optionally give permission to publish your testimonial

🙏 Your testimonials inspire other devotees and help spread the divine message of Sri Guru Raghavendra Swamy.

All testimonials are reviewed before being published to ensure they maintain the sacred atmosphere of our matha.

Visit: [Your Website]/testimonials to share your experience!`;

    const kannadaTestimonialContent = `✨ **ನಿಮ್ಮ ದೇವಸ್ಥಾನದ ಅನುಭವವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ**

ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದಲ್ಲಿ ನಿಮ್ಮ ಆಧ್ಯಾತ್ಮಿಕ ಪ್ರಯಾಣ ಮತ್ತು ಅನುಭವಗಳ ಬಗ್ಗೆ ಕೇಳಲು ನಾವು ಇಷ್ಟಪಡುತ್ತೇವೆ!

**ನಿಮ್ಮ ಸಾಕ್ಷ್ಯವನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ವಿಧಾನ:**
• ನಮ್ಮ ವೆಬ್‌ಸೈಟ್‌ನ ಸಾಕ್ಷ್ಯಗಳ ಪುಟವನ್ನು ಭೇಟಿ ಮಾಡಿ
• ನಿಮ್ಮ ಹೆಸರು, ಊರು ಮತ್ತು ಅನುಭವವನ್ನು ತುಂಬಿ
• ನಿಮ್ಮ ಭೇಟಿಯನ್ನು ರೇಟ್ ಮಾಡಿ (1-5 ಸ್ಟಾರ್)
• ನಿಮ್ಮ ಸಾಕ್ಷ್ಯವನ್ನು ಪ್ರಕಟಿಸಲು ಐಚ್ಛಿಕವಾಗಿ ಅನುಮತಿ ನೀಡಿ

🙏 ನಿಮ್ಮ ಸಾಕ್ಷ್ಯಗಳು ಇತರ ಭಕ್ತರಿಗೆ ಸ್ಫೂರ್ತಿ ನೀಡುತ್ತವೆ ಮತ್ತು ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯ ದೈವಿಕ ಸಂದೇಶವನ್ನು ಹರಡಲು ಸಹಾಯ ಮಾಡುತ್ತವೆ.`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaTestimonialContent : englishTestimonialContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("aradhana") || message.includes("raghavendra") || message.includes("swamy") || message.includes("ರಾಘವೇಂದ್ರ")) {
    const englishAradhanaContent = `🙏 **Sri Raghavendra Swamy**

Sri Raghavendra Swamy (1595–1672) was a renowned saint and philosopher of the Dvaita tradition. He is believed to have been an incarnation of Lord Venkateswara.

His Aradhana Mahotsava is celebrated annually, marking his Samadhi (the day he attained lotus feet of the Lord).

**Key Teachings:**
• Surrender to the lotus feet of the Lord
• Bhakti (devotion) as the path to salvation
• Service to humanity as service to God

🙏 To learn more about Guru Parampara (lineage), please visit our dedicated page.`;

    const kannadaAradhanaContent = `🙏 **ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ**

ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ (1595-1672) ದ್ವೈತ ಸಂಪ್ರದಾಯದ ಪ್ರಸಿದ್ಧ ಸಂತ ಮತ್ತು ತತ್ತ್ವಜ್ಞಾನಿ. ಅವರು ಭಗವಾನ್ ವೆಂಕಟೇಶ್ವರರ ಅವತಾರರೆಂದು ನಂಬಲಾಗಿದೆ.

ಅವರ ಆರಾಧನಾ ಮಹೋತ್ಸವವನ್ನು ಪ್ರತಿವರ್ಷ ಆಚರಿಸಲಾಗುತ್ತದೆ, ಇದು ಅವರು ಭಗವಂತನ ತುಳಸಿ ಪಾದಗಳನ್ನು ಪಡೆದ ದಿನವನ್ನು (ಸಮಾಧಿ) ಗುರುತಿಸುತ್ತದೆ.

**ಮುಖ್ಯ ಉಪದೇಶಗಳು:**
• ಭಗವಂತನ ತುಳಸಿ ಪಾದಗಳಿಗೆ ಶರಣಾಗತಿ
• ಮೋಕ್ಷದ ಮಾರ್ಗವಾಗಿ ಭಕ್ತಿ (ಭಕ್ತಿ)
• ಮಾನವೀಯತೆಗೆ ಸೇವೆಯು ದೇವರಿಗೆ ಸೇವೆ

🙏 ಗುರು ಪರಂಪರೆ (ವಂಶಾವಳಿ) ಬಗ್ಗೆ ಇನ್ನಷ್ಟು ತಿಳಿಯಲು ದಯವಿಟ್ಟು ನಮ್ಮ ಮತ್ಸ್ಯ ಪುಟವನ್ನು ಭೇಟಿ ಮಾಡಿ.`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaAradhanaContent : englishAradhanaContent,
      timestamp: Date.now(),
    };
  }

  if (message.includes("about") || message.includes("matha") || message.includes("temple") || message.includes("ಮಠ")) {
    const englishAboutContent = `🏛️ **About Sri Raghavendra Swamy Matha**

Located in Yelahanka New Town, Bengaluru, our matha serves as a spiritual center for devotees of Sri Raghavendra Swamy.

**Our Services:**
• Daily poojas and archana
• Festival celebrations
• Spiritual teachings and discourse
• Community welfare activities
• Annadanam (free food distribution)

🙏 We welcome all devotees to experience the divine atmosphere and seek the blessings of Sri Raghavendra Swamy.

For more information, visit our About page.`;

    const kannadaAboutContent = `🏛️ **ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದ ಬಗ್ಗೆ**

ಬೆಂಗಳೂರಿನ ಯಲಹಂಕ ನ್ಯೂ ಟೌನ್‌ನಲ್ಲಿರುವ ನಮ್ಮ ಮಠವು ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯ ಭಕ್ತರಿಗೆ ಆಧ್ಯಾತ್ಮಿಕ ಕೇಂದ್ರವಾಗಿ ಸೇವೆ ಸಲ್ಲಿಸುತ್ತದೆ.

**ನಮ್ಮ ಸೇವೆಗಳು:**
• ದೈನಿಕ ಪೂಜೆಗಳು ಮತ್ತು ಅರ್ಚನೆ
• ಹಬ್ಬದ ಆಚರಣೆಗಳು
• ಆಧ್ಯಾತ್ಮಿಕ ಉಪದೇಶಗಳು ಮತ್ತು ಪ್ರವಚನಗಳು
• ಸಮುದಾಯ ಕಲ್ಯಾಣ ಚಟುವಟಿಕೆಗಳು
• ಅನ್ನದಾನ (ಉಚಿತ ಆಹಾರ ವಿತರಣೆ)

🙏 ಎಲ್ಲಾ ಭಕ್ತರನ್ನು ದೈವಿಕ ವಾತಾವರಣವನ್ನು ಅನುಭವಿಸಲು ಮತ್ತು ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿಯ ಆಶೀರ್ವಾದವನ್ನು ಪಡೆಯಲು ಸ್ವಾಗತಿಸುತ್ತೇವೆ.

ಇನ್ನಷ್ಟು ಮಾಹಿತಿಗಾಗಿ ನಮ್ಮ ಬಗ್ಗೆ ಪುಟವನ್ನು ಭೇಟಿ ಮಾಡಿ.`;

    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: useKannada ? kannadaAboutContent : englishAboutContent,
      timestamp: Date.now(),
    };
  }

  // Default response
  const englishDefaultContent = `🙏 **Namaste, Dear Devotee!**

Thank you for your question. I'm here to help you with information about our temple.

I can assist you with:

• 🕐 Temple Timings
• 📅 Upcoming Events & Festivals
• 🙏 Sevas & Services
• 💝 Donations
• 👥 Trust Committee
• 📸 Gallery
• 📞 Contact Information
• 🤝 Volunteering

For specific inquiries or official matters, please contact the temple office:

📞 ${info.phone}
📧 ${info.email}

🙏 Sri Raghavendraya Namaha!`;

  const kannadaDefaultContent = `🙏 **ನಮಸ್ಕಾರ, ಆತ್ಮೀಯ ಭಕ್ತರೇ!**

ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಧನ್ಯವಾದಗಳು. ನಾನು ನಮ್ಮ ದೇವಸ್ಥಾನದ ಮಾಹಿತಿಯೊಂದಿಗೆ ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇನೆ.

ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಹುದು:

• 🕐 ದೇವಸ್ಥಾನದ ಸಮಯ
• 📅 ಮುಂಬರುವ ಕಾರ್ಯಕ್ರಮಗಳು ಮತ್ತು ಹಬ್ಬಗಳು
• 🙏 ಸೇವೆಗಳು ಮತ್ತು ಸೇವೆಗಳು
• 💝 ದೇಣಗಳು
• 👥 ಟ್ರಸ್ಟ್ ಸಮಿತಿ
• 📸 ಗ್ಯಾಲರಿ
• 📞 ಸಂಪರ್ಕ ಮಾಹಿತಿ
• 🤝 ಸ್ಯಾಂಪಂದನಾ

ನಿರ್ದಿಷ್ಟ ವಿಚಾರಣೆಗಳಿಗಾಗಿ ದಯವಿಟ್ಟು ದೇವಸ್ಥಾನದ ಕಛೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ:

📞 ${info.phone}
📧 ${info.email}

🙏 ಶ್ರೀ ಗುರು ರಾಘವೇಂದ್ರಾಯ ನಮಃ!`;

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: useKannada ? kannadaDefaultContent : englishDefaultContent,
    timestamp: Date.now(),
  };
}
