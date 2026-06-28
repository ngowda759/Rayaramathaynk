import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import TempleTimings from "@/components/home/TempleTimings";
import DonationCTA from "@/components/home/DonationCTA";

export default function PoojaPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="Daily Pooja Schedule"
          subtitle="Find the temple’s daily rituals, timings, and offerings."
        />

        <div className="mx-auto max-w-6xl rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm">
          <TempleTimings />
        </div>

        <div className="mt-16">
          <DonationCTA />
        </div>
      </main>
      <Footer />
    </>
  );
}
