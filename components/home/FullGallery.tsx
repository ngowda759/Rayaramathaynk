import SectionHeading from "@/components/common/SectionHeading";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const images = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1512965773411-943d4707fc22?w=1200",
    alt: "Temple exterior at sunrise",
    title: "Morning Darshan",
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?w=1200",
    alt: "Priests conducting a pooja",
    title: "Pooja Ceremony",
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1517546805237-2d00e3c1c276?w=1200",
    alt: "Temple lamp lighting",
    title: "Deepa Aradhane",
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1465153698244-3f33e45c9f0b?w=1200",
    alt: "Devotees taking part in a festival celebration",
    title: "Festive Celebration",
  },
  {
    id: 5,
    src: "https://images.unsplash.com/photo-1556009994-1090b1ef9f84?w=1200",
    alt: "Temple hall interior with traditional decor",
    title: "Sacred Interior",
  },
  {
    id: 6,
    src: "https://images.unsplash.com/photo-1502920917128-1aa500764b20?w=1200",
    alt: "Closeup of a ritual offering",
    title: "Offerings",
  },
];

export default function FullGallery() {
  return (
    <section className="space-y-12 py-16">
      <div className="space-y-4 text-center">
        <SectionHeading
          title="Temple Gallery"
          subtitle="A visual journey through the spiritual life and ceremonies at our temple."
        />
        <p className="mx-auto max-w-3xl text-base leading-8 text-stone-700">
          Browse temple rituals, festivals, and devotional moments collected from
          our community. Click any image to view the full collection.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image) => (
          <div
            key={image.id}
            className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"
          >
            <div className="relative h-72 w-full">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover transition duration-500 hover:scale-105"
              />
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-stone-900">
                {image.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {image.alt}
              </p>
            </div>
          </div>
        ))}
      </div>

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
