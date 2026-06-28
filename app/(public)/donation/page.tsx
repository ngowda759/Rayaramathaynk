import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import DonationCTA from "@/components/home/DonationCTA";

export default function DonationPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="Support the Temple"
          subtitle="Your donations help maintain the temple, support rituals, and serve the community."
        />

        <div className="mx-auto max-w-4xl rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm">
          <DonationCTA />
        </div>
      </main>
      <Footer />
    </>
  );
}
