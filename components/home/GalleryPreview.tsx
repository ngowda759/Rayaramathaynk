import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";

const images = [
  "/images/gallery1.jpg",
  "/images/gallery2.jpg",
  "/images/gallery3.jpg",
  "/images/gallery4.jpg",
  "/images/gallery5.jpg",
  "/images/gallery6.jpg",
];

export default function GalleryPreview() {
  return (
    <section className="bg-stone-50 py-24">
      <div className="mx-auto max-w-7xl px-6">

        <SectionHeading
          title="Temple Gallery"
          subtitle="Moments of devotion, festivals and divine celebrations."
        />

        <div className="mt-14 grid grid-cols-2 gap-5 md:grid-cols-3">

          {images.map((image, index) => (
            <div
              key={index}
              className="group relative aspect-[4/3] overflow-hidden rounded-3xl"
            >
              <Image
                src={image}
                alt="Temple Gallery"
                fill
                className="object-cover transition duration-700 group-hover:scale-110"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

              <div className="absolute bottom-5 left-5 translate-y-6 text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <p className="font-semibold">
                  Temple Moments
                </p>

                <p className="text-sm text-gray-200">
                  Click to explore
                </p>
              </div>
            </div>
          ))}

        </div>

        <div className="mt-14 text-center">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-8 py-4 font-semibold text-white transition hover:bg-amber-700"
          >
            View Complete Gallery
            <ArrowRight size={18} />
          </Link>
        </div>

      </div>
    </section>
  );
}
