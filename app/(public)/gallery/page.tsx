import fs from "fs";
import path from "path";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import GalleryGrid from "@/components/home/FullGallery";
import { storageService } from "@/services/storage.service";

const galleryDirectory = path.join(
  process.cwd(),
  "public",
  "images",
  "temple"
);

function getTempleImages() {
  if (!fs.existsSync(galleryDirectory)) return [];

  return fs
    .readdirSync(galleryDirectory)
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .sort()
    .map((filename, index) => {
      const label = path
        .basename(filename, path.extname(filename))
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Extract year from filename if present (e.g., "temple_2024_festival.jpg")
      const yearMatch = label.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : undefined;

      return {
        id: `img-${index + 1}`,
        type: "image" as const,
        src: `/images/temple/${filename}`,
        alt: label || "Temple image",
        title: label || `Temple image ${index + 1}`,
        year,
      };
    });
}

const videoDirectory = path.join(process.cwd(), "public", "videos");

function getLocalVideos() {
  if (!fs.existsSync(videoDirectory)) return [];

  return fs
    .readdirSync(videoDirectory)
    .filter((file) => /\.(mp4|webm|ogg)$/i.test(file))
    .sort()
    .map((filename, index) => {
      const label = path
        .basename(filename, path.extname(filename))
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Extract year from filename if present
      const yearMatch = label.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : undefined;

      return {
        id: `video-local-${index + 1}`,
        type: "video" as const,
        src: `/videos/${filename}`,
        alt: label || "Temple video",
        title: label || `Temple video ${index + 1}`,
        year,
      };
    });
}

async function getBlobVideos() {
  try {
    const videos = await storageService.listVideos();
    
    return videos.map((video, index) => {
      // Extract filename without path
      const filename = video.pathname.split("/").pop() || `video-${index + 1}`;
      const label = path
        .basename(filename, path.extname(filename))
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Extract year from filename if present
      const yearMatch = label.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? yearMatch[0] : undefined;

      return {
        id: `video-blob-${index + 1}`,
        type: "video" as const,
        src: video.url,
        alt: label || "Temple video",
        title: label || `Temple video ${index + 1}`,
        year,
      };
    });
  } catch (error) {
    console.error("[Gallery] Error fetching blob videos:", error);
    return [];
  }
}

async function getGalleryItems() {
  const images = getTempleImages();
  const localVideos = getLocalVideos();
  const blobVideos = await getBlobVideos();
  
  return [...images, ...localVideos, ...blobVideos];
}

export default async function GalleryPage() {
  const items = await getGalleryItems();

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <Breadcrumb current="Gallery" />
        </div>
        {items.length === 0 ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-12 text-center text-stone-700 shadow-sm">
              <p className="text-lg">No gallery items found yet.</p>
              <p className="mt-2 text-sm">Add images to <code>public/images/temple</code> and videos via the Admin Dashboard.</p>
            </div>
          </div>
        ) : (
          <GalleryGrid items={items} />
        )}
      </main>
      <Footer />
    </>
  );
}
