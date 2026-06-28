import fs from "fs";
import path from "path";
import SectionHeading from "@/components/common/SectionHeading";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const galleryDirectory = path.join(process.cwd(), "public", "images", "temple");

function getTemplePreviewImages() {
  if (!fs.existsSync(galleryDirectory)) return [];

  return fs
    .readdirSync(galleryDirectory)
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    .sort()
    .slice(0, 4)
    .map((filename, index) => ({
      id: index + 1,
      src: `/images/temple/${filename}`,
      alt: path
        .basename(filename, path.extname(filename))
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    }));
}

export default function GalleryPreview() {
  const images = getTemplePreviewImages();

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          title="Temple Gallery"
          subtitle="A glimpse of our spiritual celebrations, rituals and divine atmosphere."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {images.length > 0 ? (
            images.map((image) => (
              <div
                key={image.id}
                className="group overflow-hidden rounded-2xl shadow-md"
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  width={500}
                  height={500}
                  className="h-72 w-full object-cover transition duration-500 group-hover:scale-110"
                />
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-stone-200 bg-stone-50 p-12 text-center text-stone-700 shadow-sm">
              Temple images are not available yet. Add files under <code>public/images/temple</code>.
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 font-medium text-white transition hover:bg-orange-700"
          >
            View Complete Gallery
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
