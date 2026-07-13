// Knowledge Base for Temple Information
// This can be extended to fetch from Firebase in the future

import { KnowledgeItem } from "@/types/ai";

export const KNOWLEDGE_BASE: KnowledgeItem[] = [
  // Temple Information
  {
    id: "temple-about",
    category: "temple",
    question: "About the temple",
    answer: "Sri Raghavendra Swamy Math is a spiritual center dedicated to Raghavendra Swamy, a 17th-century saint and philosopher. Located in Yelahanka New Town, Bangalore, the math serves as a center for spiritual learning, devotion, and community service.",
    keywords: ["about", "history", "math", "swamy", "raghavendra"],
  },
  {
    id: "temple-timings",
    category: "temple",
    question: "What are the temple timings?",
    answer: "The temple is open from early morning to evening. For specific timings, please check the official website or contact the temple office as timings may vary for special occasions and festivals.",
    keywords: ["timings", "hours", "open", "schedule", "morning", "evening"],
  },
  {
    id: "temple-dresscode",
    category: "temple",
    question: "Is there a dress code?",
    answer: "Devotees are advised to dress modestly and conservatively when visiting the temple. Traditional Indian attire is preferred. Remove footwear before entering the sanctum.",
    keywords: ["dress", "code", "clothing", "attire", "wear"],
  },

  // Sevas
  {
    id: "seva-list",
    category: "sevas",
    question: "What sevas are available?",
    answer: "The temple offers various sevas including Supahara Seva, Thiruveedhi Pooja, Gattemane Seva, Koduge Pooja, and many more. Each seva has its own significance and timing. Please contact the temple for the complete list and booking procedures.",
    keywords: ["seva", "service", "pooja", "rituals", "supahara", "thiruveedhi"],
  },
  {
    id: "seva-booking",
    category: "sevas",
    question: "How to book a seva?",
    answer: "Sevas can be booked through the temple's official website or by visiting the temple office. Some sevas can be booked online through our booking portal.",
    keywords: ["book", "booking", "schedule", "online", "register"],
  },

  // Events
  {
    id: "events-upcoming",
    category: "events",
    question: "What events are coming up?",
    answer: "The temple organizes various events throughout the year including festivals, spiritual discourses, and community programs. Check our Events page for upcoming events and festival celebrations.",
    keywords: ["events", "festivals", "celebrations", "upcoming", "program"],
  },
  {
    id: "events-rts",
    category: "events",
    question: "What is Raghavendra Thiruvachana Sotsavam?",
    answer: "Raghavendra Thiruvachana Sotsavam is an important annual festival celebrating the saint Raghavendra Swamy. The festival includes special poojas, processions, and cultural programs.",
    keywords: ["rts", "thiruvachana", "sotsavam", "annual", "festival"],
  },

  // Donations
  {
    id: "donate-how",
    category: "donations",
    question: "How can I donate?",
    answer: "Donations can be made through our secure online portal on the website, or directly at the temple office. We accept various forms of donations including online transfers, cash, and kind.",
    keywords: ["donate", "donation", "contribute", "contribution", "support"],
  },
  {
    id: "donate-use",
    category: "donations",
    question: "How are donations used?",
    answer: "Donations support temple maintenance, daily rituals, charity activities, community programs, and infrastructure development. We maintain transparency in fund utilization.",
    keywords: ["use", "utilization", "purpose", "where", "support"],
  },
  {
    id: "donate-80g",
    category: "donations",
    question: "Is donation tax-deductible?",
    answer: "Yes, donations to the temple trust may be eligible for tax benefits under Section 80G of the Income Tax Act. Please contact the temple office for donation receipts and certificates.",
    keywords: ["80g", "tax", "benefit", "receipt", "certificate"],
  },

  // Volunteer
  {
    id: "volunteer-join",
    category: "volunteer",
    question: "How can I become a volunteer?",
    answer: "We welcome devotees who wish to serve at the temple. Volunteers can help with various activities including event management, sevakalam, and community service. Please reach out to learn more about volunteer opportunities.",
    keywords: ["volunteer", "join", "serve", "help", "sevakalam"],
  },

  // Committee
  {
    id: "committee-trust",
    category: "committee",
    question: "Who is on the trust committee?",
    answer: "The temple is managed by a dedicated trust committee comprising experienced devotees and trustees. For information about current committee members, please visit the Trust Committee page on our website.",
    keywords: ["committee", "trust", "members", "trustees", "management"],
  },

  // Contact
  {
    id: "contact-info",
    category: "contact",
    question: "How do I contact the temple?",
    answer: "You can contact the temple office during working hours. For specific queries, please use the contact information provided on our Contact page.",
    keywords: ["contact", "phone", "email", "address", "reach", "location"],
  },
  {
    id: "contact-address",
    category: "contact",
    question: "What is the temple address?",
    answer: "Sri Raghavendra Swamy Math is located in Yelahanka New Town, Bangalore. For detailed directions and address, please visit the Contact page on our website.",
    keywords: ["address", "location", "directions", "map", "where"],
  },

  // Gallery
  {
    id: "gallery-view",
    category: "gallery",
    question: "Can I see photos of the temple?",
    answer: "Yes! We have a Gallery section on our website featuring photos of the temple, festivals, events, and daily rituals. Visit the Gallery page to explore.",
    keywords: ["gallery", "photos", "images", "pictures", "view"],
  },

  // General
  {
    id: "general-greeting",
    category: "general",
    question: "Hello",
    answer: "🙏 Namaste! Welcome to Sri Raghavendra Swamy Math. I am Raya AI, your friendly assistant. How may I help you today?",
    keywords: ["hello", "hi", "namaste", "greetings", "hey"],
  },
  {
    id: "general-thanks",
    category: "general",
    question: "Thank you",
    answer: "🙏 Thank you for reaching out, dear devotee! It is our privilege to assist you. Please feel free to ask if you have any more questions. Jai Raghavendra Swamy!",
    keywords: ["thanks", "thank", "grateful", "appreciate"],
  },
];

// Search knowledge base for relevant items
export function searchKnowledge(query: string): KnowledgeItem[] {
  const lowercaseQuery = query.toLowerCase();
  
  return KNOWLEDGE_BASE.filter((item) => {
    return (
      item.question.toLowerCase().includes(lowercaseQuery) ||
      item.answer.toLowerCase().includes(lowercaseQuery) ||
      item.keywords.some((keyword) => keyword.toLowerCase().includes(lowercaseQuery))
    );
  }).slice(0, 3); // Return top 3 matches
}

// Get knowledge item by category
export function getKnowledgeByCategory(category: string): KnowledgeItem[] {
  return KNOWLEDGE_BASE.filter((item) => item.category === category);
}

// Get all categories
export function getCategories(): string[] {
  return [...new Set(KNOWLEDGE_BASE.map((item) => item.category))];
}
