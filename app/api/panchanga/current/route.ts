import { NextResponse } from "next/server";
import { promisify } from "util";
import { execFile } from "child_process";
import path from "path";

const execFileAsync = promisify(execFile);

const DEFAULT_LAT = 13.1005;
const DEFAULT_LON = 77.5963;
const DEFAULT_TZ = "Asia/Kolkata";

export async function GET() {
  try {
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

    return NextResponse.json(JSON.parse(stdout));
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}
