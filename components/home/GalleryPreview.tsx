import { getTempleGalleryImages } from "@/lib/gallery";
import TempleGalleryPreview from "./TempleGalleryPreview";

export default function GalleryPreview() {
  const gallery = getTempleGalleryImages();

  if (gallery.length === 0) {
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

  return <TempleGalleryPreview items={gallery} />;
}
