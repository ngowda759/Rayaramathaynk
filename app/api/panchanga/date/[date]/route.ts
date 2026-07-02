import { NextRequest, NextResponse } from "next/server";
import { promisify } from "util";
import { execFile } from "child_process";
import path from "path";

const execFileAsync = promisify(execFile);

const DEFAULT_LAT = 13.1005;
const DEFAULT_LON = 77.5963;
const DEFAULT_TZ = "Asia/Kolkata";

type Params = {
  params: Promise<{
    date: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  { params }: Params
) {
  try {
    const { date } = await params;

    const script = path.join(
      process.cwd(),
      "scripts",
      "panchanga.py"
    );

    const { stdout, stderr } = await execFileAsync("python3", [
      script,
      "--date",
      date,
      "--lat",
      DEFAULT_LAT.toString(),
      "--lon",
      DEFAULT_LON.toString(),
      "--tz",
      DEFAULT_TZ,
    ]);

    if (stderr) {
      console.error(stderr);
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
