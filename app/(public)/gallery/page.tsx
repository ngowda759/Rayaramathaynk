import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import GalleryPreview from "@/components/home/GalleryPreview";

export default function GalleryPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="Temple Gallery"
          subtitle="View our temple’s photo collection and spiritual moments."
        />

        <GalleryPreview />

        <div className="mt-12 text-center">
          <Link
            href="/gallery"
            className="inline-flex items-center justify-center rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            Browse all photos
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
