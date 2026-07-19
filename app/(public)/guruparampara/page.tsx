import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { BookOpen, Sparkles } from "lucide-react";
import InteractiveGuruParampara from "@/components/guru/InteractiveGuruParampara";

export default function GuruparamparaPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-8 md:py-10">
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
            <Breadcrumb current="Guru Parampara" />
            <div className="text-center mt-4">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 backdrop-blur">
                <Sparkles className="h-5 w-5 text-amber-200" />
                <span className="text-sm font-medium text-white">
                  Sacred Tradition
                </span>
              </div>

              <h1 className="text-4xl font-bold text-white md:text-5xl">
                The Sacred Guru Parampara
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-xl text-amber-100">
                The Lineage of Pontiffs from Sri Madhwacharya to Present
              </p>

              <div className="mt-8 flex justify-center gap-8 text-amber-200">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">
                    17
                  </div>
                  <div className="text-sm">Gurus</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">800+</div>
                  <div className="text-sm">Years</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Intro Section */}
        <section className="px-6 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <BookOpen className="mx-auto h-16 w-16 text-amber-600" />
            <h2 className="mt-6 text-3xl font-bold text-stone-900">
              Preserving the Divine Lineage
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-stone-600">
              The Guru Parampara of Sri Raghavendra Swamy Matha traces its
              lineage from Sri Madhvacharya through an unbroken chain of
              spiritual masters. Each pontiff in this lineage has contributed
              to the preservation and propagation of Dwaita philosophy, Vedic
              traditions, and the service to Lord Rama.
            </p>
          </div>
        </section>

        {/* Interactive Guru Parampara */}
        <section className="bg-gradient-to-b from-amber-50 to-white px-6 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <InteractiveGuruParampara />
          </div>
        </section>

        {/* Closing Section */}
        <section className="px-6 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <div className="rounded-3xl bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 p-12 text-white">
              <h2 className="text-3xl font-bold">|| Gururājō Vijayatē ||</h2>
              <p className="mt-4 text-lg text-amber-100">
                May the Guru&apos;s glory always prevail. Through this sacred
                lineage, the divine teachings continue to guide and illuminate
                the path of devotion for all seekers.
              </p>

              <div className="mt-8 flex justify-center gap-6 text-amber-200">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">
                    || Hari Sarvōttama ||
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-white">
                    || Vāyu Jīvōttama ||
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
