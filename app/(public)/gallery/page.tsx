import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FullGallery from "@/components/home/FullGallery";

export default function GalleryPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <FullGallery />
      </main>
      <Footer />
    </>
  );
}
