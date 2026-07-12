"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { Building2, BookOpen, Heart, GraduationCap, Music, Sparkles } from "lucide-react";

interface FuturePlan {
  id: string;
  title: string;
  titleKannada: string;
  description: string;
  descriptionKannada: string;
  icon: string;
  isActive: boolean;
  order: number;
}

interface FuturePlansData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  plans: FuturePlan[];
}

const defaultFuturePlans: FuturePlansData = {
  heading: "Future Plans",
  headingKannada: "ಟ್ರಸ್ಟ್ ನ ಮುಂದಿನ ಮಹತ್ವಾಕಾಂಕ್ಷಿ ಯೋಜನೆಗಳು",
  subheading: "Join us in our journey to preserve and propagate the sacred traditions",
  subheadingKannada: "ನಮ್ಮ ಯಾತ್ರೆಯಲ್ಲಿ ಭಾಗಿಯಾಗಿ ಪವಿತ್ರ ಸಂಪ್ರದಾಯಗಳನ್ನು ಸಂರಕ್ಷಿಸಲು ಮತ್ತು ಪ್ರಸರಣ ಮಾಡಲು ನಮಗೆ ಸಹಾಯ ಮಾಡಿ",
  plans: [
    {
      id: "1",
      title: "Modern Building Project",
      titleKannada: "ಅತ್ಯಾಧುನಿಕ ಕಟ್ಟಡ ಯೋಜನೆ",
      description: "Plans to construct a modern 4-story building for the Matha with ample parking, meditation hall, modern kitchen, and a spacious hall that can accommodate at least 450 people. The building will have lifts and other modern amenities. Devotees can participate in this grand project.",
      descriptionKannada: "ಶ್ರೀ ಮಠದ ಮುಂದಿನ ದಿನಗಳಲ್ಲಿ 4 ಮಹಡಿಗಳ ಅತ್ಯಾಧುನಿಕ ಕಟ್ಟಡವನ್ನು ಗುರುರಾಜರಿಗೆ ಸಮರ್ಪಿಸಲು ಸಂಕಲ್ಪಿಸಲಾಗಿದೆ. ಕಟ್ಟಡವು ಆಧುನಿಕ ಪಾರ್ಕಿಂಗ್ ವ್ಯವಸ್ಥೆ, ಧ್ಯಾನ – ಪ್ರವಚನ ಮಂದಿರ, ಆಧುನಿಕ ಅಡಿಗೆ ಮನೆ, ಒಂದು ಮಹಡಿಯಲ್ಲಿ ಕನಿಷ್ಠ 450 ಕುಳಿತುಕೊಳ್ಳಲು ಅನುಕೂಲವಾಗುವಂತೆ ವಿಶಾಲ ಹಾಲ್. ಭಕ್ತರಿಗೆ ಎಲ್ಲಾ ಶುಭ ಕಾರ್ಯಕ್ರಮಗಳನ್ನು ಆಯೋಜಿಸಲು ಅನುಕೂಲವಾಗುವಂತೆ 2 ಸಣ್ಣ ಹಾಲ್. ಕಟ್ಟಡಕ್ಕೆ ಲಿಫ್ಟ್ ಸೌಲಭ್ಯ ಹಾಗೂ ಇನ್ನಿತರ ಆದುನಿಕ ಸೌಲಭ್ಯಗಳನ್ನು ಹೊಂದಿರುತ್ತದೆ. ಈ ಬೃಹತ್ ಯೋಜನೆಯಲ್ಲಿ ನೀವೂ ನಿಮ್ಮ ಯಥಾ ಶಕ್ತಿ ಪಾಲ್ಗೊಳ್ಳಬಹುದು.",
      icon: "building",
      isActive: true,
      order: 1,
    },
    {
      id: "2",
      title: "Knowledge Dissemination Project",
      titleKannada: "ಜ್ಞಾನ ಪ್ರಸಾರ ಯೋಜನೆ",
      description: "Annual knowledge dissemination activities including Madhvacharya philosophy propagation, Purana discussions, and lectures are planned throughout the year. A special endowment fund will be established for this purpose. You can participate in this project by offering a lecture service as your service.",
      descriptionKannada: "ಶ್ರೀ ಮಠದಲ್ಲಿ ವರ್ಷಪೂರ್ತಿ ಜ್ಞಾನ ಪ್ರಸಾರ ಕಾರ್ಯಗಳು, ಮಧ್ವಾಚಾರ್ಯರ ಸಿದ್ಧಾಂತ ಪ್ರಸಾರ, ಪುರಾಣಗಳು, ಉಪನ್ಯಾಸಗಳನ್ನು ವರ್ಷಪೂರ್ತಿ ನಡೆಸಲು ಆಯೋಜಿಸಲಾಗಿದೆ. ಈ ಕಾರ್ಯಕ್ಕೆ ಅನುಕೂಲವಾಗುವಂತೆ ವಿಶೇಷ ದತ್ತಿ ನಿಧಿಯನ್ನು ಸ್ಥಾಪಿಸಲು ಯೋಜಿಸಲಾಗಿದೆ. ಈ ಯೋಜನೆಯಲ್ಲಿ ತಾವೂ ಪಾಲ್ಗೊಳ್ಳಬಹುದು. ಈ ಯೋಜನೆಯಲ್ಲಿ ಒಂದು ಉಪನ್ಯಾಸದ ಸೇವೆಯನ್ನು ತಮ್ಮ ಸೇವೆಯಲ್ಲಿ ನಡೆಸಬಹುದು.",
      icon: "book",
      isActive: true,
      order: 2,
    },
    {
      id: "3",
      title: "Gomata Protection Project",
      titleKannada: "ಗೋ ಸಂರಕ್ಷಣಾ ಯೋಜನೆ",
      description: "Protection of cows is our primary duty. We already maintain a Goshaala with the best breed of cows from Malenadu. We plan to continue Gomata service on a larger scale in the future.",
      descriptionKannada: "ಗೋವಿನ ಸಂರಕ್ಷಣೆಯು ನಮ್ಮ ಆದ್ಯ ಕರ್ತವ್ಯದಲ್ಲಿ ಒಂದಾಗಿದೆ. ವಿಶೇಷವಾಗಿ ಮಲೆನಾಡಿನ ಅತ್ಯುತ್ತಮ ತಳಿಗಳ ಗೋವುಗಳನ್ನು ಸಂರಕ್ಷಿಸುವುದು, ಗೋವಿನ ಸೇವೆಗೆ, ಈಗಾಗಲೇ ನಮ್ಮದೇ ಆದ ಗೋಶಾಲೆ ನಡೆಸುತ್ತಿದ್ದೇವೆ. ಮುಂದಿನ ದಿನಗಳಲ್ಲಿ ಇನ್ನೂ ದೊಡ್ಡ ಮಟ್ಟದಲ್ಲಿ ಗೋಸೇವೆ ಮುಂದುವರಿಸಲು ಸಂಕಲ್ಪಿಸಲಾಗಿದೆ.",
      icon: "heart",
      isActive: true,
      order: 3,
    },
    {
      id: "4",
      title: "Vedic Education",
      titleKannada: "ವೈದಿಕ ಶಿಕ್ಷಣ",
      description: "Vedas will be prepared for teaching Vedic education, mantras, sukthas, deity worship methods to children and elders at the Matha. Mantra Stotra classes have already started and other classes will be started soon. Everyone can avail these facilities free of cost.",
      descriptionKannada: "ಶ್ರೀ ಮಠದಲ್ಲಿ ಮಕ್ಕಳಿಗೆ ಹಾಗೂ ಹಿರಿಯರಿಗೆ ವೈದಿಕ ಶಿಕ್ಷಣ, ಶ್ಲೋಕಗಳು, ಮಂತ್ರಗಳು, ಸೂಕ್ತಗಳು, ದೇವತಾ ಪೂಜಾ ವಿಧಾನಗಳು ಕಲಿಸಲು ವೇದಿಕೆಯನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ. ಮಂತ್ರ ಸ್ತೋತ್ರ ತರಗತಿಗಳು ಈಗಾಗಲೇ ಪ್ರಾರಂಭಾಗಿದ್ದು ಇತರ ತರಗತಿಗಳನ್ನು ಸದ್ಯದಲ್ಲೇ ಪ್ರಾರಂಭಿಸಲು ಯೋಜಿಸಲಾಗಿದೆ. ಎಲ್ಲಾರೂ ಈ ಸೌಲಭ್ಯಗಳನ್ನು ಉಚಿತವಾಗಿ ಪಡೆದುಕೊಳ್ಳಬಹುದು.",
      icon: "graduation",
      isActive: true,
      order: 4,
    },
    {
      id: "5",
      title: "Cultural Education",
      titleKannada: "ಸಾಂಸ್ಕೃತಿಕ ಶಿಕ್ಷಣ",
      description: "Committed to transform the Matha into a social and cultural center of faith, music, Bharatanatyam, Talavadya and other arts will be taught here.",
      descriptionKannada: "ಶ್ರೀ ಮಠವನ್ನು ಸಾಮಾಜಿಕ ಹಾಗೂ ಸಾಂಸ್ಕೃತಿಕ ಶ್ರದ್ದಾ ಕೇಂದ್ರವಾಗಿ ಮಾರ್ಪಡಿಸಲು ಕಟಿಬದ್ಧವಾಗಿದೆ, ಈ ಯೋಜನೆಯಲ್ಲಿ ಸಂಗೀತ, ಭರತನಾಟ್ಯ, ತಾಳವಾದ್ಯ ಮೊದಲಾದ ಕಲೆಗಳನ್ನು ಹೇಳಿಕೊಡಲಾಗುವುದು.",
      icon: "music",
      isActive: true,
      order: 5,
    },
  ],
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  building: Building2,
  book: BookOpen,
  heart: Heart,
  graduation: GraduationCap,
  music: Music,
};

export default function FuturePlansPage() {
  const [data, setData] = useState<FuturePlansData>(defaultFuturePlans);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        if (!db) {
          setLoading(false);
          return;
        }
        const docRef = doc(db, "settings", "futurePlans");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData({ ...defaultFuturePlans, ...docSnap.data() } as FuturePlansData);
        }
      } catch (error) {
        console.error("Error loading future plans:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activePlans = data.plans.filter((p) => p.isActive).sort((a, b) => a.order - b.order);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-teal-700 to-emerald-900 py-16">
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
            <Breadcrumb current="Future Plans" />
            <div className="text-center mt-4">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 backdrop-blur">
                <Sparkles className="h-5 w-5 text-emerald-200" />
                <span className="text-sm font-medium text-white">Vision 2025+</span>
              </div>

              <h1 className="text-4xl font-bold text-white md:text-5xl">
                {data.heading}
              </h1>
              <p className="mx-auto mt-4 text-2xl text-emerald-100 font-serif">
                {data.headingKannada}
              </p>
              <p className="mx-auto mt-6 max-w-3xl text-xl text-emerald-100">
                {data.subheading}
              </p>
              <p className="mx-auto mt-2 max-w-3xl text-lg text-emerald-200 font-serif">
                {data.subheadingKannada}
              </p>
            </div>
          </div>
        </section>

        {/* Plans Section */}
        <section className="bg-gradient-to-b from-emerald-50 to-white px-6 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-5xl">
            <div className="space-y-8">
              {activePlans.map((plan) => {
                const IconComponent = iconMap[plan.icon] || Sparkles;
                return (
                  <div
                    key={plan.id}
                    className="group relative overflow-hidden rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-lg"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                          <IconComponent className="h-8 w-8" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-stone-900">
                          {plan.title}
                        </h3>
                        <p className="mt-1 text-lg text-emerald-600 font-serif">
                          {plan.titleKannada}
                        </p>

                        {/* Description */}
                        <p className="mt-4 leading-relaxed text-stone-600">
                          {plan.description}
                        </p>
                        <p className="mt-2 leading-relaxed text-stone-600 font-serif italic">
                          {plan.descriptionKannada}
                        </p>
                      </div>
                    </div>

                    {/* Decorative Element */}
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 opacity-50 blur-2xl" />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="px-6 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-600 to-emerald-800 p-12 text-white">
              <Heart className="mx-auto h-16 w-16 text-emerald-200" />
              <h2 className="mt-6 text-3xl font-bold">Join Our Sacred Mission</h2>
              <p className="mt-4 text-lg text-emerald-100">
                Your contribution helps preserve and propagate the sacred traditions
                of Sri Raghavendra Swamy Matha for future generations.
              </p>
              <a
                href="/donation"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-emerald-700 transition hover:scale-105 hover:bg-emerald-50"
              >
                <Heart className="h-5 w-5" />
                Contribute Now
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
