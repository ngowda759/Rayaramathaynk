import { NextResponse } from "next/server";
import { promisify } from "util";
import { execFile } from "child_process";
import path from "path";

const execFileAsync = promisify(execFile);

const DEFAULT_LAT = 13.1005;
const DEFAULT_LON = 77.5963;
const DEFAULT_TZ = "Asia/Kolkata";

export async function POST() {
  try {
    const script = path.join(
      process.cwd(),
      "scripts",
      "panchanga.py"
    );

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const { stdout } = await execFileAsync("python3", [
      script,
      "--date",
      today,
      "--lat",
      DEFAULT_LAT.toString(),
      "--lon",
      DEFAULT_LON.toString(),
      "--tz",
      DEFAULT_TZ,
    ]);

    const data = JSON.parse(stdout);

    // TODO:
    // Save `data` to Firebase/Firestore here.

    return NextResponse.json({
      success: true,
      refreshedAt: new Date().toISOString(),
      data,
    });
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
