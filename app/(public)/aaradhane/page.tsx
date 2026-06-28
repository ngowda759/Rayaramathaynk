import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";

export default function AaradhanePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white px-6 py-16 sm:px-8 lg:px-12">
        <SectionHeading
          title="Aaradhane Services"
          subtitle="Discover aaradhane timings and special worship offerings."
        />

        <div className="mx-auto max-w-5xl rounded-3xl border border-stone-200 bg-stone-50 p-8 shadow-sm">
          <p className="text-lg leading-8 text-stone-700">
            Aaradhane is a sacred tradition conducted every day at the temple.
            Join us for devotional worship and blessings in a peaceful setting.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-stone-900">Daily Aaradhane</h3>
              <p className="mt-3 text-stone-700">
                Regular worship sessions open to all devotees.
              </p>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-stone-900">Festive Aaradhane</h3>
              <p className="mt-3 text-stone-700">
                Special aradhane during festivals and holy days.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
