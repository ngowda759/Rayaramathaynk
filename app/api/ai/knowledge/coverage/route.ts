import { NextResponse } from "next/server";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// Public website pages mapped to categories
const PUBLIC_PAGES_CATEGORIES = [
  { id: "aaradhane", name: "Aaradhane", description: "Aaradhane festival and events" },
  { id: "about", name: "About", description: "About the temple/matha" },
  { id: "donation", name: "Donation", description: "How to donate and tax benefits (80G)" },
  { id: "events", name: "Events", description: "Temple events and schedules" },
  { id: "facilities", name: "Facilities", description: "Available amenities and services" },
  { id: "future-plans", name: "Future Plans", description: "Temple development plans" },
  { id: "gallery", name: "Gallery", description: "Photo gallery" },
  { id: "guruparampara", name: "Guru Parampara", description: "Guru lineage and teachings" },
  { id: "journey", name: "Temple Journey", description: "Temple establishment and journey" },
  { id: "pooja", name: "Pooja Services", description: "Daily poojas and special sevas" },
  { id: "sevas", name: "Sevas", description: "Volunteer and seva opportunities" },
  { id: "shlokas", name: "Shlokas", description: "Sacred slokas and mantras" },
  { id: "temple-explorer", name: "Temple Explorer", description: "Temple areas and facilities" },
  { id: "testimonials", name: "Testimonials", description: "Devotee testimonials" },
  { id: "trust", name: "Trust", description: "Trust committee and management" },
  { id: "volunteer", name: "Volunteer", description: "Volunteer program and opportunities" },
  { id: "faq", name: "FAQ", description: "Frequently asked questions" },
  { id: "contact", name: "Contact", description: "Contact information and office hours" },
  { id: "dress-code", name: "Dress Code", description: "Appropriate attire for visiting" },
  { id: "parking", name: "Parking", description: "Parking information and availability" },
  { id: "history", name: "Temple History", description: "History of the temple" },
  { id: "raghavendra-swamy", name: "Sri Raghavendra Swamy", description: "Biography and teachings" },
  { id: "brindavana", name: "Brindavana", description: "The sacred samadhi information" },
  { id: "madhvacharya", name: "Sri Madhvacharya", description: "Madhvacharya biography and philosophy" },
  { id: "mantralaya", name: "Mantralaya", description: "Mantralaya pilgrimage site" },
];

// Default required categories
const DEFAULT_CATEGORIES = [
  ...PUBLIC_PAGES_CATEGORIES,
  { id: "photography", name: "Photography", description: "Photography policy and guidelines" },
  { id: "accommodation", name: "Accommodation", description: "Guest house and lodging facilities" },
];

interface CoverageStatus {
  id: string;
  name: string;
  description: string;
  status: "present" | "missing";
  articleId?: string;
  articleTitle?: string;
  updatedAt?: Date;
}

export async function GET() {
  try {
    // If Firebase is not configured, return mock data
    if (!isFirebaseConfigured() || !db) {
      const mockCoverage = DEFAULT_CATEGORIES.map(cat => ({
        ...cat,
        status: "missing" as const,
      }));
      
      return NextResponse.json({
        success: true,
        data: {
          coverage: mockCoverage,
          summary: {
            total: DEFAULT_CATEGORIES.length,
            present: 0,
            missing: DEFAULT_CATEGORIES.length,
            percentage: 0,
          },
          lastChecked: new Date().toISOString(),
          note: "Firebase not configured. Run 'npm run seed:ai' to initialize knowledge."
        }
      });
    }

    // Get all approved articles from knowledge collection
    const articlesRef = collection(db, "knowledge");
    const publishedQuery = query(articlesRef, where("approved", "==", true));
    const snapshot = await getDocs(publishedQuery);
    
    const existingCategories = new Map<string, { id: string; title: string; updatedAt: Date }>();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.category) {
        existingCategories.set(data.category, {
          id: doc.id,
          title: data.title || data.category,
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      }
    });

    // Build coverage status
    const coverage: CoverageStatus[] = DEFAULT_CATEGORIES.map(cat => {
      const existing = existingCategories.get(cat.id);
      
      if (existing) {
        return {
          ...cat,
          status: "present" as const,
          articleId: existing.id,
          articleTitle: existing.title,
          updatedAt: existing.updatedAt,
        };
      }
      
      return {
        ...cat,
        status: "missing" as const,
      };
    });

    const present = coverage.filter(c => c.status === "present").length;
    const missing = coverage.filter(c => c.status === "missing").length;
    const percentage = Math.round((present / DEFAULT_CATEGORIES.length) * 100);

    return NextResponse.json({
      success: true,
      data: {
        coverage,
        summary: {
          total: DEFAULT_CATEGORIES.length,
          present,
          missing,
          percentage,
        },
        lastChecked: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error("Error checking knowledge coverage:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check knowledge coverage" },
      { status: 500 }
    );
  }
}
