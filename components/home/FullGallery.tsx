import fs from "fs";
import path from "path";
import SectionHeading from "@/components/common/SectionHeading";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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

      return {
        id: index + 1,
        type: "image" as const,
        src: `/images/temple/${filename}`,
        alt: label || "Temple image",
        title: label || `Temple image ${index + 1}`,
      };
    });
}

const videoDirectory = path.join(process.cwd(), "public", "videos");

function getTempleVideos() {
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

      return {
        id: `video-${index + 1}`,
        type: "video" as const,
        src: `/videos/${filename}`,
        alt: label || "Temple video",
        title: label || `Temple video ${index + 1}`,
      };
    });
}

function getGalleryItems() {
  return [...getTempleImages(), ...getTempleVideos()];
}

export default function FullGallery() {
  const items = getGalleryItems();

  return (
    <section className="space-y-12 py-16">
      <div className="space-y-4 text-center">
        <SectionHeading
          title="Temple Gallery"
          subtitle="A visual journey through the spiritual life and ceremonies at our temple."
        />
        <p className="mx-auto max-w-3xl text-base leading-8 text-stone-700">
          Browse temple rituals, festivals, devotional moments, and a featured
          temple video from our community.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-stone-200 bg-stone-50 p-12 text-center text-stone-700 shadow-sm">
          No temple images found yet. Add files under <code>public/images/temple</code>.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"
            >
              <div className="relative h-72 w-full bg-black">
                {item.type === "image" ? (
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    className="object-cover transition duration-500 hover:scale-105"
                  />
                ) : (
                  <iframe
                    src={item.src}
                    title={item.title}
                    className="h-full w-full"
                    loading="lazy"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )}
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-stone-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {item.alt}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <Link
          href="/gallery"
          className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-700"
        >
          View more gallery photos
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
