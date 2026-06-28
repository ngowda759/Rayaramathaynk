import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import UpcomingEvents from "@/components/home/UpcomingEvents";

export default function EventsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="Temple Events"
          subtitle="Explore upcoming programs, festivals, and spiritual gatherings."
        />

        <UpcomingEvents />
      </main>
      <Footer />
    </>
  );
}
