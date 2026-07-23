import { NextRequest, NextResponse } from "next/server";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, query, where } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

// Knowledge categories - must match categories in seed files
const REQUIRED_CATEGORIES = [
  "temple-timings",
  "visitor-guidelines",
  "dress-code",
  "facilities",
  "parking",
  "volunteer",
  "faq",
  "contact",
  "donation",
  "photography",
  "accommodation",
  "history",
  "raghavendra-swamy",
  "brindavana",
  "about-trust",
  // Additional categories for complete coverage
  "aaradhane",
  "about",
  "events",
  "future-plans",
  "gallery",
  "guruparampara",
  "journey",
  "pooja",
  "sevas",
  "shlokas",
  "temple-explorer",
  "testimonials",
  "trust",
  "madhvacharya",
  "mantralaya",
];

interface SeedArticle {
  title: string;
  category: string;
  content: string;
  published?: boolean;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const { overwrite = false } = await request.json().catch(() => ({ overwrite: false }));

    if (!isFirebaseConfigured() || !db) {
      return NextResponse.json(
        { success: false, error: "Firebase not configured" },
        { status: 503 }
      );
    }

    const seedDir = path.join(process.cwd(), "seed", "ai");

    if (!fs.existsSync(seedDir)) {
      return NextResponse.json(
        { success: false, error: "Seed directory not found" },
        { status: 404 }
      );
    }

    // Get existing approved articles from knowledge collection
    const existingArticles = new Map<string, string>();
    if (!overwrite) {
      const articlesRef = collection(db, "knowledge");
      const q = query(articlesRef, where("approved", "==", true));
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.category) {
          existingArticles.set(data.category, docSnap.id);
        }
      });
    }

    // Get seed files
    const seedFiles = fs.readdirSync(seedDir).filter((f) => f.endsWith(".json"));

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const results: Array<{ file: string; status: "imported" | "skipped" | "error"; message?: string }> = [];

    for (const file of seedFiles) {
      const filePath = path.join(seedDir, file);

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const article: SeedArticle = JSON.parse(content);

        if (!article.category) {
          results.push({ file, status: "error", message: "Missing category" });
          errors++;
          continue;
        }

        // Skip if exists and not overwriting
        if (existingArticles.has(article.category)) {
          results.push({ file, status: "skipped", message: "Already exists" });
          skipped++;
          continue;
        }

        // Create article
        const articleId = article.category.replace(/-/g, "_");
        const articleRef = doc(db, "knowledge", articleId);

        await setDoc(articleRef, {
          ...article,
          id: articleId,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: "system-seed",
          version: 1,
          tags: [article.category, ...((article.tags as string[]) || [])],
        });

        results.push({ file, status: "imported", message: article.title });
        imported++;

      } catch (error) {
        results.push({ file, status: "error", message: String(error) });
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        errors,
        results,
        summary: {
          total: seedFiles.length,
          coverage: Math.round((imported / REQUIRED_CATEGORIES.length) * 100),
        },
      },
    });

  } catch (error) {
    console.error("Error importing knowledge:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import knowledge" },
      { status: 500 }
    );
  }
}
