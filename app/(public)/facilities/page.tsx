import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import {
  Flame,
  UtensilsCrossed,
  Building2,
  Volume2,
  Sparkles,
  Users,
  ShieldCheck,
} from "lucide-react";

const facilities = [
  {
    icon: Flame,
    title: "Homa & Seva Facilities",
    description:
      "Sri Matha is fully equipped to perform all kinds of Homas, Pitrukaryas, and Sevas according to Vedic traditions. We have in-house experienced Purohitas who are available to guide and conduct rituals with complete devotion and adherence to Shastra.",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: Building2,
    title: "Spacious Halls",
    description:
      "We offer a range of halls to accommodate various spiritual and family events: 1 Large Hall (up to 200 people) and 4 Small Halls (50-100 people each). Whether it's a Pitrukarya, Homa, family ceremony, or spiritual event, our spacious halls ensure convenience and a peaceful environment.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Users,
    title: "Theertha Prasada Hall",
    description:
      "Our Theertha Prasada section can accommodate up to 500 devotees at a time, ensuring smooth and comfortable prasada distribution during festivals, special sevas, and daily offerings.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: UtensilsCrossed,
    title: "Pure & Traditional Food Preparation",
    description:
      "At Sri Matha, we uphold the highest traditions of purity. Food is prepared entirely using wood fire, followed strictly for Madi Naivedya and Theertha Prasada. This ensures the sanctity, aroma, and traditional taste that devotees cherish.",
    color: "from-amber-500 to-yellow-500",
  },
  {
    icon: Volume2,
    title: "Modern Amenities",
    description:
      "Modern Public Announcement (Sound) System for clear communication during pujas and events. Clean and well-maintained toilets with Western-style commodes for elders and those in need of additional comfort. Hygienic and accessible facilities throughout the premises.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Sparkles,
    title: "Devotion, Tradition & Convenience",
    description:
      "Sri Matha is dedicated to providing a sacred, serene, and well-equipped environment for all devotees. With a blend of traditional values and modern amenities, we ensure every seva, homa, and Pitrukarya is performed with devotion, comfort, and authenticity.",
    color: "from-rose-500 to-red-500",
  },
];

const amenities = [
  "Wheelchair accessible premises",
  "Dedicated parking space",
  "Pure vegetarian kitchen",
  "Wood-fired cooking",
  "Madi-maintained facilities",
  "Clean drinking water",
  "First aid facility",
  "Dedicated Purohit services",
];

export default function FacilitiesPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-24">
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

          <div className="relative mx-auto max-w-7xl px-6 text-center">
            <h1 className="text-5xl font-bold text-white md:text-6xl">
              Matha Facilities
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-xl text-amber-100">
              Sri Matha is dedicated to providing a sacred, serene, and
              well-equipped environment for all devotees. With a blend of
              traditional values and modern amenities, we ensure every seva,
              homa, and Pitrukarya is performed with devotion, comfort, and
              authenticity.
            </p>
          </div>
        </section>

        {/* Main Facilities Grid */}
        <section className="px-6 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              title="Our Facilities"
              subtitle="Everything you need for a meaningful spiritual experience"
            />

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {facilities.map((facility, index) => {
                const Icon = facility.icon;
                return (
                  <div
                    key={index}
                    className="group relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                  >
                    <div
                      className={`inline-flex rounded-2xl bg-gradient-to-r ${facility.color} p-4 text-white shadow-lg`}
                    >
                      <Icon size={32} />
                    </div>

                    <h3 className="mt-6 text-2xl font-bold text-stone-900">
                      {facility.title}
                    </h3>

                    <p className="mt-4 leading-relaxed text-stone-600">
                      {facility.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Amenities List */}
        <section className="bg-gradient-to-br from-amber-50 to-orange-50 px-6 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-2">
              <div>
                <h2 className="text-4xl font-bold text-stone-900">
                  Additional Amenities
                </h2>
                <p className="mt-4 text-lg text-stone-600">
                  We strive to make every visit comfortable and convenient for
                  all devotees, regardless of age or ability.
                </p>

                <div className="mt-8 space-y-4">
                  {amenities.map((amenity, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                        <ShieldCheck className="h-5 w-5 text-amber-600" />
                      </div>
                      <span className="text-lg font-medium text-stone-700">
                        {amenity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 opacity-20 blur-2xl" />
                  <div className="relative rounded-3xl bg-gradient-to-br from-amber-100 to-orange-100 p-12 text-center">
                    <div className="text-8xl">🛕</div>
                    <h3 className="mt-6 text-2xl font-bold text-stone-900">
                      Welcome to Sri Matha
                    </h3>
                    <p className="mt-4 text-stone-600">
                      Experience the divine ambience and spiritual serenity at
                      our sacred premises.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-bold text-stone-900">
              Visit Us Today
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              Experience the divine ambience, participate in regular poojas,
              and join our temple community events.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <div className="rounded-2xl bg-amber-50 px-8 py-4">
                <p className="text-sm font-medium text-stone-500">
                  Morning Darshan
                </p>
                <p className="text-xl font-bold text-amber-700">
                  6:00 AM – 1:00 PM
                </p>
              </div>
              <div className="rounded-2xl bg-orange-50 px-8 py-4">
                <p className="text-sm font-medium text-stone-500">
                  Evening Darshan
                </p>
                <p className="text-xl font-bold text-orange-700">
                  4:30 PM – 8:30 PM
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
