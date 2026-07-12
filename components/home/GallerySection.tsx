import GalleryPreviewClient from "./GalleryPreviewClient";
import { motion } from "framer-motion";
import { Images as ImagesIcon } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface GalleryImage {
  src: string;
  alt: string;
  category: string;
}

interface GallerySectionProps {
  images: GalleryImage[];
}

export default function GallerySection({ images }: GallerySectionProps) {
  if (images.length === 0) {
    return (
      <section className="bg-gradient-to-b from-white to-[#fff8ef] py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-3xl border border-stone-200 bg-stone-50 p-12 text-center text-stone-700 shadow-sm">
            No temple images found yet. Add files under <code>public/images/temple</code>.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gradient-to-b from-white to-[#fff8ef] py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            TEMPLE GALLERY
          </span>
          <h2 className="mt-6 text-5xl font-bold text-stone-900">
            Moments of Devotion
          </h2>
          <p className="mt-6 text-lg leading-8 text-stone-600">
            Experience the beauty of our temple through festivals, daily poojas and memorable spiritual celebrations.
          </p>
        </motion.div>

        {/* Gallery with Lightbox and Filters */}
        <div className="mt-16">
          <GalleryPreviewClient images={images} />
        </div>

        {/* CTA Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 rounded-[32px] bg-gradient-to-r from-amber-600 to-orange-500 p-10 text-white"
        >
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            <div className="flex items-center gap-5">
              <div className="rounded-2xl bg-white/20 p-4">
                <ImagesIcon size={34} />
              </div>
              <div>
                <h3 className="text-3xl font-bold">Explore Our Complete Gallery</h3>
                <p className="mt-2 text-amber-100">Festivals • Poojas • Annadanam • Celebrations</p>
              </div>
            </div>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 font-semibold text-amber-700 transition hover:scale-105"
            >
              View Gallery
              <ArrowRight size={18} />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
