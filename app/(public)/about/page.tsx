import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="About Sri Raghavendra Swamy Temple"
          subtitle="Learn about our faith, history, and service to the Yelahanka New Town community."
        />

        <div className="mx-auto max-w-4xl space-y-8 text-base leading-8 text-stone-700">
          <p>
            Sri Raghavendra Swamy Temple is dedicated to preserving ancient
            traditions and serving our community with compassionate worship,
            devotional activities, and cultural programs.
          </p>

          <p>
            Our temple offers daily rituals, special sevas, spiritual teachings,
            and a warm place for families to gather in faith.
          </p>

          <p>
            Visit us to experience the divine ambience, participate in regular
            poojas, and join our temple community events.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
