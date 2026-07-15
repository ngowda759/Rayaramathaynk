import { NextResponse } from "next/server";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// Required knowledge categories for complete coverage
const REQUIRED_CATEGORIES = [
  { id: "temple-timings", name: "Temple Timings", description: "Daily darshan timings and office hours" },
  { id: "visitor-guidelines", name: "Visitor Guidelines", description: "Temple rules and etiquette" },
  { id: "dress-code", name: "Dress Code", description: "Appropriate attire for visiting" },
  { id: "facilities", name: "Facilities", description: "Available amenities and services" },
  { id: "parking", name: "Parking", description: "Parking information and availability" },
  { id: "volunteer", name: "Volunteer", description: "Volunteer program and opportunities" },
  { id: "faq", name: "FAQ", description: "Frequently asked questions" },
  { id: "contact", name: "Contact", description: "Contact information and office hours" },
  { id: "donation", name: "Donation", description: "How to donate and tax benefits" },
  { id: "photography", name: "Photography", description: "Photography policy and guidelines" },
  { id: "accommodation", name: "Accommodation", description: "Guest house and lodging facilities" },
  { id: "history", name: "Temple History", description: "History of the temple" },
  { id: "raghavendra-swamy", name: "Sri Raghavendra Swamy", description: "Biography and teachings" },
  { id: "brindavana", name: "Brindavana", description: "The sacred samadhi information" },
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
      const mockCoverage = REQUIRED_CATEGORIES.map(cat => ({
        ...cat,
        status: "missing" as const,
      }));
      
      return NextResponse.json({
        success: true,
        data: {
          coverage: mockCoverage,
          summary: {
            total: REQUIRED_CATEGORIES.length,
            present: 0,
            missing: REQUIRED_CATEGORIES.length,
            percentage: 0,
          },
          lastChecked: new Date().toISOString(),
          note: "Firebase not configured. Run 'npm run seed:ai' to initialize knowledge."
        }
      });
    }

    // Get all published articles
    const articlesRef = collection(db, "articles");
    const publishedQuery = query(articlesRef, where("published", "==", true));
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
    const coverage: CoverageStatus[] = REQUIRED_CATEGORIES.map(cat => {
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
    const percentage = Math.round((present / REQUIRED_CATEGORIES.length) * 100);

    return NextResponse.json({
      success: true,
      data: {
        coverage,
        summary: {
          total: REQUIRED_CATEGORIES.length,
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
