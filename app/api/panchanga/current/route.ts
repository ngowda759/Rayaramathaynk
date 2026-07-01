import { NextResponse } from "next/server";

// Proxy endpoint that returns the current Panchanga for the temple location.
// Uses Vedic Rishi's free API by default. Override coordinates via env:
// TEMPLE_LAT, TEMPLE_LON, TEMPLE_TZ

export async function GET() {
  try {
    const lat = process.env.TEMPLE_LAT ?? "13.1295";
    const lon = process.env.TEMPLE_LON ?? "77.5859";
    const tz = process.env.TEMPLE_TZ ?? "Asia/Kolkata";

    const today = new Date().toISOString().slice(0, 10);

    const url = `https://api.vedicrishi.dev/v1/panchang?date=${today}&lat=${lat}&long=${lon}&tzone=${encodeURIComponent(
      tz
    )}`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Provider returned ${res.status}: ${text}`);
    }

    const data = await res.json();

    // Flexible mapping: provider field names may vary; try common shapes
    const tithi =
      data?.tithi?.tithi || data?.tithi?.panchang || data?.tithi || "";
    const nakshatra =
      data?.nakshatra?.nakshatra || data?.nakshatra?.panchang || data?.nakshatra || "";
    const yoga = data?.yoga?.yoga || data?.yoga?.panchang || data?.yoga || "";
    const karana = data?.karana?.karana || data?.karana?.panchang || data?.karana || "";
    const sunrise = data?.sunrise || data?.sun_rise || data?.sun.rise || "";
    const sunset = data?.sunset || data?.sun_set || data?.sun.set || "";

    return NextResponse.json({ tithi, nakshatra, yoga, karana, sunrise, sunset });
  } catch (err: any) {
    console.error("/api/panchanga/current error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
