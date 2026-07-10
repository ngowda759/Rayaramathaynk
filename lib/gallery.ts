import { readdirSync } from "fs";
import { join } from "path";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];

function normalizeFileName(filename: string) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export type GalleryItem = {
  image: string;
  title: string;
  size: string;
};

export function getTempleGalleryImages(): GalleryItem[] {
  const galleryDir = join(process.cwd(), "public", "images", "temple");
  let files: string[] = [];

  try {
    files = readdirSync(galleryDir).filter((file) =>
      IMAGE_EXTENSIONS.includes(file.slice(-4).toLowerCase()) ||
      IMAGE_EXTENSIONS.includes(file.slice(-5).toLowerCase())
    );
  } catch {
    return [];
  }

  const sorted = files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  return sorted.map((file, index) => ({
    image: `/images/temple/${file}`,
    title: normalizeFileName(file),
    size:
      index === 0
        ? "row-span-2"
        : index === 4
        ? "col-span-2"
        : "",
  }));
}
