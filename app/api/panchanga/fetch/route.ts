import { NextResponse } from "next/server";
import { homepageService } from "@/services/homepage.service";
import { getCachedPanchanga } from "@/lib/panchanga-cache";

// Server route: fetches today's Panchanga from a provider and saves to homepage config.
// Provider: Vedic Rishi (default). Override with env vars:
// PANCHANGA_PROVIDER ("vedicrishi"), TEMPLE_LAT, TEMPLE_LON, TEMPLE_TZ
// Falls back to cached panchanga data when external API is unavailable.

async function fetchWithRetry(
  url: string,
  maxRetries: number = 2
): Promise<Response> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      let timeoutId: any;

      try {
        timeoutId = setTimeout(() => {
          controller.abort();
        }, 5000); // 5s timeout

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return res;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // wait 500ms before retry
      }
    }
  }

  throw lastError;
}

export async function GET(req: Request) {
  try {
    const provider = process.env.PANCHANGA_PROVIDER ?? "vedicrishi";

    // default coordinates for Yelahanka New Town (Bengaluru)
    const lat = process.env.TEMPLE_LAT ?? "13.1295";
    const lon = process.env.TEMPLE_LON ?? "77.5859";
    const tz = process.env.TEMPLE_TZ ?? "Asia/Kolkata";

    const today = new
    Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkota",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
    }).format(new Date());

    let panchangaResult: any = {};

    if (provider === "vedicrishi") {
      const url = `https://api.vedicrishi.dev/v1/panchang?date=${today}&lat=${lat}&long=${lon}&tzone=${encodeURIComponent(
        tz
      )}`;

      try {
        const res = await fetchWithRetry(url);
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
        };
      } catch (fetchErr: any) {
        console.warn("/api/panchanga/fetch: API unavailable, using cached data", fetchErr?.message);
        // Use cached panchanga instead of empty values
        const cached = getCachedPanchanga(today);
        panchangaResult = {
          tithi: cached.tithi,
          nakshatra: cached.nakshatra,
          yoga: cached.yoga,
          karana: cached.karana,
          sunrise: cached.sunrise,
          sunset: cached.sunset,
        };
      }
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
    // Use cached data as fallback
    const cached = getCachedPanchanga();
    return NextResponse.json({ ok: false, error: err?.message ?? String(err), fallback: cached });
  }
}
