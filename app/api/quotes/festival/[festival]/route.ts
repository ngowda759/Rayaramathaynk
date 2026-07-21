/**
 * Quote by Festival API
 * /api/quotes/festival/[festival] - Get quotes for a specific festival
 */

import { NextRequest, NextResponse } from "next/server";
import { quoteService } from "@/services/quote.service";
import { FestivalName } from "@/types/quote";

const VALID_FESTIVALS: FestivalName[] = [
  "raghavendra_aradhana",
  "guru_purnima",
  "madhwa_navami",
  "vyasa_pooja",
  "rama_navami",
  "krishna_janmashtami",
  "narasimha_jayanti",
  "hanuman_jayanti",
  "deepavali",
  "vaikuntha_ekadashi",
  "brahmotsava",
  "navaratri",
  "mahashivaratri",
  "ratha_saptami",
  "makara_sankramana",
];

// GET /api/quotes/festival/[festival]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ festival: string }> }
) {
  try {
    const { festival } = await params;
    
    if (!VALID_FESTIVALS.includes(festival as FestivalName)) {
      return NextResponse.json(
        { 
          error: "Invalid festival name",
          validFestivals: VALID_FESTIVALS 
        },
        { status: 400 }
      );
    }

    const quotes = await quoteService.getFestivalQuote(festival as FestivalName);

    return NextResponse.json({
      festival,
      quotes,
      total: quotes.length,
    });
  } catch (error: any) {
    console.error("[Quote Festival API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch festival quotes", details: error.message },
      { status: 500 }
    );
  }
}
