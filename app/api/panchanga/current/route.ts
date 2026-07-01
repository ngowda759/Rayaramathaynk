import { NextResponse } from "next/server";
import { getCachedPanchanga } from "@/lib/panchanga-cache";

// Proxy endpoint that returns the current Panchanga for the temple location.
// Uses Vedic Rishi's free API by default. Override coordinates via env:
// TEMPLE_LAT, TEMPLE_LON, TEMPLE_TZ
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

export async function GET() {
  try {
    const lat = process.env.TEMPLE_LAT ?? "13.1295";
    const lon = process.env.TEMPLE_LON ?? "77.5859";
    const tz = process.env.TEMPLE_TZ ?? "Asia/Kolkata";

    const today = new Date().toISOString().slice(0, 10);

    const url = `https://api.vedicrishi.dev/v1/panchang?date=${today}&lat=${lat}&long=${lon}&tzone=${encodeURIComponent(
      tz
    )}`;

    let data: any;
    try {
      const res = await fetchWithRetry(url);
      if (!res.ok) {
        throw new Error(`Provider returned ${res.status}`);
      }
      data = await res.json();
    } catch (fetchErr: any) {
      console.warn("/api/panchanga/current: API unavailable, using cached data", fetchErr?.message);
      // Use cached panchanga instead of "unavailable" messages
      const cached = getCachedPanchanga(today);
      return NextResponse.json(cached);
    }

    // Flexible mapping: provider field names may vary; try common shapes
    const tithi =
      data?.tithi?.tithi || data?.tithi?.panchang || data?.tithi || "";
    const nakshatra =
      data?.nakshatra?.nakshatra || data?.nakshatra?.panchang || data?.nakshatra || "";
    const yoga = data?.yoga?.yoga || data?.yoga?.panchang || data?.yoga || "";
    const karana = data?.karana?.karana || data?.karana?.panchang || data?.karana || "";
    const sunrise = data?.sunrise || data?.sun_rise || data?.sun?.rise || "";
    const sunset = data?.sunset || data?.sun_set || data?.sun?.set || "";

    // If we got valid data from the API, return it
    if (tithi && nakshatra && sunrise && sunset) {
      return NextResponse.json({ tithi, nakshatra, yoga, karana, sunrise, sunset });
    }

    // Partial data; fall back to cached
    const cached = getCachedPanchanga(today);
    return NextResponse.json(cached);
  } catch (err: any) {
    console.error("/api/panchanga/current error:", err);
    // Return cached data as final fallback
    const cached = getCachedPanchanga();
    return NextResponse.json(cached);
  }
}
