import SectionHeading from "@/components/common/SectionHeading";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

const images = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800",
    alt: "Temple View",
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1605647540924-852290f6b0d5?w=800",
    alt: "Pooja",
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800",
    alt: "Festival",
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=800",
    alt: "Temple Lamp",
  },
];

export default function GalleryPreview() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          title="Temple Gallery"
          subtitle="A glimpse of our spiritual celebrations, rituals and divine atmosphere."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((image) => (
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
          ))}
        </div>

        <div className="mt-12 text-center">
          <button className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 font-medium text-white transition hover:bg-orange-700">
            View Complete Gallery
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
