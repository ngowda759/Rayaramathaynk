import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import TempleTimings from "@/components/home/TempleTimings";
import DonationCTA from "@/components/home/DonationCTA";

export default function PoojaPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        <div className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <SectionHeading
            title="Daily Pooja Schedule"
            subtitle="Find the temple's daily rituals, timings, and offerings."
          />
        </div>

        <TempleTimings />

        <div className="px-4 pb-16 sm:px-6 lg:px-8">
          <DonationCTA />
        </div>
      </main>
      <Footer />
    </>
  );
}
