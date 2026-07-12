import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import SevaBooking from "@/components/home/SevaBooking";

export default function SevasPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <Breadcrumb current="Special Sevas" />
        </div>
        <SectionHeading
          title="Special Sevas"
          subtitle="Book special sevas and spiritual offerings at the temple."
        />

        <div className="mx-auto max-w-6xl space-y-8">
          <div className="rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm">
            <p className="text-lg leading-8 text-stone-700">
              We offer a range of sevas and special puja services for devotees.
              Book online or contact the temple office for more details.
            </p>
          </div>

          <SevaBooking />
        </div>
      </main>
      <Footer />
    </>
  );
}
