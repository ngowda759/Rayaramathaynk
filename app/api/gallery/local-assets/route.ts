import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const imageDirectory = path.join(process.cwd(), "public", "images", "temple");
const videoDirectory = path.join(process.cwd(), "public", "videos");

function normalizeFilename(filename: string) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLocalAssets(directory: string, allowed: RegExp, prefix: string) {
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory)
    .filter((file) => allowed.test(file))
    .sort()
    .map((filename) => ({
      id: `${prefix}-${filename}`,
      src: `${prefix}/${filename}`,
      title: normalizeFilename(filename) || filename,
      alt: normalizeFilename(filename) || "Local gallery asset",
    }));
}

export async function GET() {
  const localImages = getLocalAssets(imageDirectory, /\.(jpe?g|png|webp)$/i, "/images/temple");
  const localVideos = getLocalAssets(videoDirectory, /\.(mp4|webm|ogg)$/i, "/videos");

  return NextResponse.json({ localImages, localVideos });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const { src } = body as { src?: string };

  if (!src || typeof src !== "string") {
    return NextResponse.json({ error: "Invalid src" }, { status: 400 });
  }

  const normalized = path.posix.normalize(src);
  if (!normalized.startsWith("/images/temple/") && !normalized.startsWith("/videos/")) {
    return NextResponse.json({ error: "Unauthorized path" }, { status: 403 });
  }

  const filePath = path.join(process.cwd(), "public", normalized);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
