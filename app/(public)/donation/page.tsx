import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import DonationCTA from "@/components/home/DonationCTA";
import DonationForm from "@/components/home/DonationForm";

export default function DonationPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="Support the Temple"
          subtitle="Your donations help maintain the temple, support rituals, and serve the community."
        />

        <div className="mx-auto max-w-6xl space-y-8">
          <DonationCTA />

          <DonationForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
