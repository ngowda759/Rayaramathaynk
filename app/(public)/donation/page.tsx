import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import DonationForm from "@/components/home/DonationForm";
import { Heart } from "lucide-react";

export default function DonationPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-12">
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
            <Breadcrumb current="Donate" />
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white md:text-5xl">
                E-Donations
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-amber-100">
                Your generous contributions help maintain the temple, support
                rituals, and serve the community.
              </p>

              <div className="mt-8 flex justify-center gap-8 text-amber-200">
                <div className="text-center">
                  <Heart className="mx-auto h-8 w-8" />
                  <p className="mt-2 text-sm">Support Rituals</p>
                </div>
                <div className="text-center">
                  <Heart className="mx-auto h-8 w-8" />
                  <p className="mt-2 text-sm">Temple Maintenance</p>
                </div>
                <div className="text-center">
                  <Heart className="mx-auto h-8 w-8" />
                  <p className="mt-2 text-sm">Community Service</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Donation Content */}
        <section className="px-6 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <DonationForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
