import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import TempleExplorer from "@/components/temple-explorer/TempleExplorer";
import { MapPin, Compass, Sparkles } from "lucide-react";

export default function TempleExplorerPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-white to-amber-50">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-12 md:py-16">
          <div className="absolute inset-0 opacity-10">
            <div
              className="h-full w-full"
              style={{
                backgroundImage: "url('/images/Hero.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-6">
            <Breadcrumb current="Temple Explorer" parentHref="/" parentName="Home" />
            
            <div className="mt-8 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 backdrop-blur">
                <Compass className="h-5 w-5 text-amber-200" />
                <span className="text-sm font-medium text-white">
                  Virtual Tour
                </span>
              </div>

              <h1 className="text-4xl font-bold text-white md:text-5xl">
                Temple Explorer
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-xl text-amber-100">
                Discover the sacred spaces, halls, and facilities of Sri Raghavendra Swamy Matha
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 backdrop-blur">
                  <MapPin className="h-4 w-4 text-amber-200" />
                  <span className="text-sm font-medium text-white">Yelahanka, Bangalore</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 backdrop-blur">
                  <Sparkles className="h-4 w-4 text-amber-200" />
                  <span className="text-sm font-medium text-white">800+ Years of Heritage</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Explorer Content */}
        <section className="px-6 py-12 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <TempleExplorer />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
