import { NextResponse } from "next/server";
import { knowledgeService } from "@/services/knowledge.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/knowledge
 * Get Knowledge Centre homepage data
 */
export async function GET() {
  try {
    const data = await knowledgeService.getKnowledgeCentreData();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error fetching knowledge centre data:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge centre data" },
      { status: 500 }
    );
  }
}
