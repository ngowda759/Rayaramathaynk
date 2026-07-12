import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import EventGrid from "@/components/events/EventGrid";

export default function EventsPage() {
  return (
    <>
      <Navbar />

      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <Breadcrumb current="Events" />
        </div>
        <SectionHeading
          title="Temple Events"
          subtitle="Explore upcoming festivals, poojas, spiritual programs and community gatherings."
        />

        <div className="mt-12">
          <EventGrid />
        </div>
      </main>

      <Footer />
    </>
  );
}
