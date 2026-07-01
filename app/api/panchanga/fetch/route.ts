import { NextResponse } from "next/server";
import { homepageService } from "@/services/homepage.service";

// Server route: fetches today's Panchanga from a provider and saves to homepage config.
// Provider: Vedic Rishi (default). Override with env vars:
// PANCHANGA_PROVIDER ("vedicrishi"), TEMPLE_LAT, TEMPLE_LON, TEMPLE_TZ

export async function GET(req: Request) {
  try {
    const provider = process.env.PANCHANGA_PROVIDER ?? "vedicrishi";

    // default coordinates for Yelahanka New Town (Bengaluru)
    const lat = process.env.TEMPLE_LAT ?? "13.1295";
    const lon = process.env.TEMPLE_LON ?? "77.5859";
    const tz = process.env.TEMPLE_TZ ?? "Asia/Kolkata";

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let panchangaResult: any = {};

    if (provider === "vedicrishi") {
      const url = `https://api.vedicrishi.dev/v1/panchang?date=${today}&lat=${lat}&long=${lon}&tzone=${encodeURIComponent(
        tz
      )}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Provider error: ${res.statusText}`);

      const data = await res.json();

      // Map fields from VedicRishi response
      panchangaResult = {
        tithi: data?.tithi?.panchang ?? "",
        nakshatra: data?.nakshatra?.panchang ?? "",
        yoga: data?.yoga?.panchang ?? "",
        karana: data?.karana?.panchang ?? "",
        sunrise: data?.sunrise ?? "",
        sunset: data?.sunset ?? "",
        // the API may include festival-like info; leave featuredFestival to empty
      };
    } else {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    // Save into homepage config (merge)
    const homepage = await homepageService.getHomepage();

    const updated = {
      ...homepage,
      panchanga: {
        tithi: panchangaResult.tithi || "",
        nakshatra: panchangaResult.nakshatra || "",
        yoga: panchangaResult.yoga || "",
        karana: panchangaResult.karana || "",
      },
      morningOpen: panchangaResult.sunrise || homepage.morningOpen,
      eveningClose: panchangaResult.sunset || homepage.eveningClose,
    };

    await homepageService.saveHomepage(updated as any);

    return NextResponse.json({ ok: true, data: panchangaResult });
  } catch (err: any) {
    console.error("/api/panchanga/fetch error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
