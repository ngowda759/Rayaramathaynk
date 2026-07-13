import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { AIMessage } from "@/types/ai";

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

// Generate response based on user message
export async function generateFirebaseResponse(
  userMessage: string,
  templeInfo: TempleInfo | null
): Promise<AIMessage> {
  const message = userMessage.toLowerCase();

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

  // Response generators for common queries
  if (message.includes("timing") || message.includes("open") || message.includes("hour")) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `🕐 **Temple Timings**

**Morning:** ${info.timings.morning.open} - ${info.timings.morning.close}
**Evening:** ${info.timings.evening.open} - ${info.timings.evening.close}

🙏 Please note: Special timings apply during festivals and special occasions.

For the most accurate information, please contact the temple office.`,
      timestamp: Date.now(),
    };
  }

  if (message.includes("event") || message.includes("festival") || message.includes("upcoming")) {
    if (info.upcomingEvents.length > 0) {
      const eventsList = info.upcomingEvents
        .map((e) => `• **${e.title}** - ${e.date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`)
        .join("\n");
      
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `📅 **Upcoming Events**

${eventsList}

🙏 We welcome all devotees to participate in these sacred celebrations!

For more details, please visit our Events page or contact the temple office.`,
        timestamp: Date.now(),
      };
    }
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `📅 **Upcoming Events**

Currently, there are no upcoming events scheduled on our website. However, we regularly hold:

• Daily poojas
• Ekadashi fasting and celebrations  
• Sri Raghavendra Jayanthi
• Bramhotsavam

🙏 For the latest updates, please check our Events page or contact the temple office directly.`,
      timestamp: Date.now(),
    };
  }

  if (message.includes("seva") || message.includes("service") || message.includes("pooja")) {
    if (info.sevas.length > 0) {
      const sevasList = info.sevas
        .map((s) => `• **${s.name}**${s.price ? ` - ${s.price}` : ""}\n  ${s.description}`)
        .join("\n\n");
      
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `🙏 **Sevas Available**

${sevasList}

🙏 To book a seva or for more information, please visit the Sevas page or contact the temple office.`,
        timestamp: Date.now(),
      };
    }
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `🙏 **Temple Sevas**

We offer various sevas including:

• **Daily Pooja** - Morning and evening services
• **Suptharadhana** - Special offerings
• **Maha Pooja** - Grand pooja ceremonies
• **Astothram** - 108 names recitation
• **Archana** - Personal poojas

🙏 For bookings and inquiries, please visit our Sevas page or contact the temple office.`,
      timestamp: Date.now(),
    };
  }

  if (message.includes("donat") || message.includes("contribute")) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `💝 **Donations & Contributions**

Your generous donations help us maintain the temple and continue our services.

**Ways to Donate:**
• Visit our Donation page on the website
• Contact the temple office for bank transfer details
• Donate in person at the temple

🙏 Every contribution, big or small, is deeply appreciated and goes towards maintaining the sacred space and services.

**Bank Details:**
For wire transfers, please contact the temple office for current bank information.`,
      timestamp: Date.now(),
    };
  }

  if (message.includes("trust") || message.includes("committee") || message.includes("member")) {
    if (info.trustMembers.length > 0) {
      const membersList = info.trustMembers
        .map((m) => `• **${m.name}** - ${m.role}`)
        .join("\n");
      
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `👥 **Trust Committee**

${membersList}

🙏 For any official matters, please contact the trust committee through the temple office.`,
        timestamp: Date.now(),
      };
    }
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `👥 **Trust Committee**

Our trust committee manages the temple operations and spiritual activities. For information about current members and their roles, please contact the temple office directly.

🙏 We welcome devotees to participate in temple activities and volunteer for various services.`,
      timestamp: Date.now(),
    };
  }

  if (message.includes("contact") || message.includes("phone") || message.includes("email") || message.includes("address")) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `📞 **Contact Information**

**Sri Raghavendra Swamy Matha**
${info.address}

**Phone:** ${info.phone}
**Email:** ${info.email}

🙏 We welcome your calls and visits during temple hours. Please note that office hours may vary.`,
      timestamp: Date.now(),
    };
  }

  if (message.includes("gallery") || message.includes("photo")) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `📸 **Temple Gallery**

Visit our Gallery page to see beautiful images of:

• Temple architecture and deity
• Festival celebrations
• Daily poojas
• Annadanam (food donation) services
• Utsavam (festivals)

🙏 Each image captures the divine atmosphere and devotion at our matha. We invite you to visit us in person to experience the spiritual bliss!`,
      timestamp: Date.now(),
    };
  }

  if (message.includes("volunteer") || message.includes("sevaka")) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `🤝 **Volunteer Opportunities**

We welcome devotees who wish to serve the temple!

**Ways to Volunteer:**
• Help during daily poojas
• Assist in festival preparations
• Participate in Annadanam (food service)
• Guide visitors and devotees
• Help with temple maintenance

🙏 To express your interest in volunteering, please contact the temple office or speak with a priest during your visit.

Your service is considered a sacred karma (duty) and will be richly blessed!`,
      timestamp: Date.now(),
    };
  }

  if (message.includes("aradhana") || message.includes("raghavendra") || message.includes("swamy")) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `🙏 **Sri Raghavendra Swamy**

Sri Raghavendra Swamy (1595–1672) was a renowned saint and philosopher of the Dvaita tradition. He is believed to have been an incarnation of Lord Venkateswara.

His Aradhana Mahotsava is celebrated annually, marking his Samadhi (the day he attained lotus feet of the Lord).

**Key Teachings:**
• Surrender to the lotus feet of the Lord
• Bhakti (devotion) as the path to salvation
• Service to humanity as service to God

🙏 To learn more about Guru Parampara (lineage), please visit our dedicated page.`,
      timestamp: Date.now(),
    };
  }

  if (message.includes("about") || message.includes("matha") || message.includes("temple")) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `🏛️ **About Sri Raghavendra Swamy Matha**

Located in Yelahanka New Town, Bengaluru, our matha serves as a spiritual center for devotees of Sri Raghavendra Swamy.

**Our Services:**
• Daily poojas and archana
• Festival celebrations
• Spiritual teachings and discourse
• Community welfare activities
• Annadanam (free food distribution)

🙏 We welcome all devotees to experience the divine atmosphere and seek the blessings of Sri Raghavendra Swamy.

For more information, visit our About page.`,
      timestamp: Date.now(),
    };
  }

  // Default response
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: `🙏 **Namaste, Dear Devotee!**

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

🙏 Sri Raghavendraya Namaha!`,
    timestamp: Date.now(),
  };
}
