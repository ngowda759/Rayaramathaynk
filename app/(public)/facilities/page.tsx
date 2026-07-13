"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SectionHeading from "@/components/common/SectionHeading";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldCheck, Flame, Building2, Users, UtensilsCrossed, Volume2, Sparkles } from "lucide-react";

interface Facility {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
}

interface Amenity {
  id: string;
  title: string;
}

interface FacilitiesData {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  pageTitle: string;
  pageSubtitle: string;
  sectionTitle: string;
  sectionSubtitle: string;
  facilities: Facility[];
  amenitiesTitle: string;
  amenitiesSubtitle: string;
  amenities: Amenity[];
}

const defaultData: FacilitiesData = {
  heroTitle: "Matha Facilities",
  heroSubtitle: "Sri Matha is dedicated to providing a sacred, serene, and well-equipped environment for all devotees. With a blend of traditional values and modern amenities, we ensure every seva, homa, and Pitrukarya is performed with devotion, comfort, and authenticity.",
  heroImageUrl: "/images/Hero.jpg",
  pageTitle: "Our Facilities",
  pageSubtitle: "Everything you need for a meaningful spiritual experience",
  sectionTitle: "Visit Us Today",
  sectionSubtitle: "Experience the divine ambience, participate in regular poojas, and join our temple community events.",
  facilities: [
    {
      id: "1",
      icon: "Flame",
      title: "Homa & Seva Facilities",
      description: "Sri Matha is fully equipped to perform all kinds of Homas, Pitrukaryas, and Sevas according to Vedic traditions. We have in-house experienced Purohitas who are available to guide and conduct rituals with complete devotion and adherence to Shastra.",
      color: "from-orange-500 to-amber-500",
    },
    {
      id: "2",
      icon: "Building2",
      title: "Spacious Halls",
      description: "We offer a range of halls to accommodate various spiritual and family events: 1 Large Hall (up to 200 people) and 4 Small Halls (50-100 people each).",
      color: "from-blue-500 to-cyan-500",
    },
    {
      id: "3",
      icon: "Users",
      title: "Theertha Prasada Hall",
      description: "Our Theertha Prasada section can accommodate up to 500 devotees at a time, ensuring smooth and comfortable prasada distribution during festivals, special sevas, and daily offerings.",
      color: "from-green-500 to-emerald-500",
    },
    {
      id: "4",
      icon: "UtensilsCrossed",
      title: "Pure & Traditional Food Preparation",
      description: "At Sri Matha, we uphold the highest traditions of purity. Food is prepared entirely using wood fire, followed strictly for Madi Naivedya and Theertha Prasada.",
      color: "from-amber-500 to-yellow-500",
    },
    {
      id: "5",
      icon: "Volume2",
      title: "Modern Amenities",
      description: "Modern Public Announcement (Sound) System for clear communication during pujas and events. Clean and well-maintained toilets with Western-style commodes for elders.",
      color: "from-purple-500 to-pink-500",
    },
    {
      id: "6",
      icon: "Sparkles",
      title: "Devotion, Tradition & Convenience",
      description: "Sri Matha is dedicated to providing a sacred, serene, and well-equipped environment for all devotees. With a blend of traditional values and modern amenities.",
      color: "from-rose-500 to-red-500",
    },
  ],
  amenitiesTitle: "Additional Amenities",
  amenitiesSubtitle: "We strive to make every visit comfortable and convenient for all devotees, regardless of age or ability.",
  amenities: [
    { id: "1", title: "Wheelchair accessible premises" },
    { id: "2", title: "Dedicated parking space" },
    { id: "3", title: "Pure vegetarian kitchen" },
    { id: "4", title: "Wood-fired cooking" },
    { id: "5", title: "Madi-maintained facilities" },
    { id: "6", title: "Clean drinking water" },
    { id: "7", title: "First aid facility" },
    { id: "8", title: "Dedicated Purohit services" },
  ],
};

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Flame,
  Building2,
  Users,
  UtensilsCrossed,
  Volume2,
  Sparkles,
};

const colorOptions = [
  "from-orange-500 to-amber-500",
  "from-blue-500 to-cyan-500",
  "from-green-500 to-emerald-500",
  "from-amber-500 to-yellow-500",
  "from-purple-500 to-pink-500",
  "from-rose-500 to-red-500",
  "from-teal-500 to-cyan-500",
  "from-indigo-500 to-purple-500",
];

export default function FacilitiesPage() {
  const [data, setData] = useState<FacilitiesData>(defaultData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        if (!db) {
          setLoading(false);
          return;
        }
        const docRef = doc(db, "settings", "facilities");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData({ ...defaultData, ...docSnap.data() } as FacilitiesData);
        }
      } catch (error) {
        console.error("Error loading facilities data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-16">
          {data.heroImageUrl && (
            <div className="absolute inset-0 opacity-10">
              <Image
                src={data.heroImageUrl}
                alt="Temple"
                fill
                className="object-cover"
              />
            </div>
          )}

          <div className="relative mx-auto max-w-7xl px-6">
            <Breadcrumb current="Facilities" />
            <div className="text-center mt-4">
              <h1 className="text-4xl font-bold text-white md:text-5xl">
                {data.heroTitle}
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-xl text-amber-100">
                {data.heroSubtitle}
              </p>
            </div>
          </div>
        </section>

        {/* Main Facilities Grid */}
        {data.facilities && data.facilities.length > 0 && (
          <section className="px-6 py-20 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-7xl">
              <SectionHeading
                title={data.pageTitle}
                subtitle={data.pageSubtitle}
              />

              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {data.facilities.map((facility) => {
                  const IconComponent = iconMap[facility.icon] || iconMap.Flame;
                  return (
                    <div
                      key={facility.id}
                      className="group relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                    >
                      <div
                        className={`inline-flex rounded-2xl bg-gradient-to-r ${facility.color} p-4 text-white shadow-lg`}
                      >
                        <IconComponent size={32} />
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
        )}

        {/* Additional Amenities Section */}
        {data.amenities && data.amenities.length > 0 && (
          <section className="bg-gradient-to-br from-amber-50 to-orange-50 px-6 py-20 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-7xl">
              <div className="grid gap-12 lg:grid-cols-2">
                <div>
                  <h2 className="text-4xl font-bold text-stone-900">
                    {data.amenitiesTitle}
                  </h2>
                  <p className="mt-4 text-lg text-stone-600">
                    {data.amenitiesSubtitle}
                  </p>

                  <div className="mt-8 space-y-4">
                    {data.amenities.map((amenity) => (
                      <div
                        key={amenity.id}
                        className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                          <ShieldCheck className="h-5 w-5 text-amber-600" />
                        </div>
                        <span className="text-lg font-medium text-stone-700">
                          {amenity.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {data.heroImageUrl && (
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-amber-400 to-orange-400 opacity-20 blur-2xl" />
                      <div className="relative overflow-hidden rounded-3xl">
                        <Image
                          src={data.heroImageUrl}
                          alt="Temple"
                          width={400}
                          height={300}
                          className="object-cover"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="px-6 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-bold text-stone-900">
              {data.sectionTitle}
            </h2>
            <p className="mt-4 text-lg text-stone-600">
              {data.sectionSubtitle}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
