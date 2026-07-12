"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { Building2, Users, Heart, Calendar, BookOpen, MapPin, Phone, Mail } from "lucide-react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Activity {
  id: string;
  title: string;
  description: string;
}

interface AboutUsData {
  templeName: string;
  templeNameKannada: string;
  tagline: string;
  taglineKannada: string;
  tagline2: string;
  aboutTitle: string;
  aboutContent: string;
  aboutContentKannada: string;
  activitiesTitle: string;
  activities: Activity[];
  sevaTitle: string;
  sevaContent: string;
  sevaContentKannada: string;
  sevaItems: string[];
  resourcesTitle: string;
  resourcesContent: string;
  visitTitle: string;
  address: string;
  phone: string;
  phone2: string;
  email: string;
  communityTitle: string;
  communityContent: string;
  communityContentKannada: string;
  communityQuote: string;
  communityQuoteKannada: string;
}

const defaultData: AboutUsData = {
  templeName: "ಶ್ರೀ ಗುರುರಾಜ ಸೇವಾ ಸಮಿತಿ (ರಿ)",
  templeNameKannada: "ಶ್ರೀ ಗುರುರಾಜ ಸೇವಾ ಸಮಿತಿ (ರಿ)",
  tagline: "Sri Gururaja Seva Samiti (R)",
  taglineKannada: "ಶ್ರೀ ಗುರುರಾಜ ಸೇವಾ ಸಮಿತಿ (ರಿ)",
  tagline2: "Maintained by the Sri Sri Raghavendraswamy Brindavan Seva Samithi Trust (R) | Yelahanka New Town, Bengaluru",
  aboutTitle: "About the Temple",
  aboutContent: "A sacred space blessed with the divine presence of Lord Venkateswara, this temple serves as a spiritual haven for devotees in the Yelahanka New Town community.",
  aboutContentKannada: "ಭಗವಂತ ವೆಂಕಟೇಶ್ವರನ ದಿವ್ಯ ಉಪಸ್ಥಿತಿಯಿಂದ ಆಶೀರ್ವದಿಸಲ್ಪಟ್ಟ ಪವಿತ್ರ ಸ್ಥಳವಾದ ಈ ದೇವಸ್ಥಾನವು ಯೆಲಹಂಕ ನ್ಯೂ ಟೌನ್ ಸಮುದಾಯದ ಭಕ್ತರಿಗೆ ಆಧ್ಯಾತ್ಮಿಕ ಆಶ್ರಯವಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ.",
  activitiesTitle: "Our Activities",
  activities: [
    { id: "1", title: "Daily Poojas", description: "Morning and evening rituals including Suprabhata, Archane, and Harathi" },
    { id: "2", title: "Special Sevas", description: "Weekly and monthly sevas including Archane with Harathi, Annadana, and more" },
    { id: "3", title: "Festivals", description: "Celebration of all Hindu festivals including Gururaja Aradhana, Ram Navami, and Janmashtami" },
    { id: "4", title: "Spiritual Discourses", description: "Regular bhajans, pravachanas, and religious lectures" }
  ],
  sevaTitle: "Seva Offerings",
  sevaContent: "We offer various sevas (services) that devotees can book to participate in temple activities and earn punya:",
  sevaContentKannada: "ಭಕ್ತರು ದೇವಸ್ಥಾನದ ಚಟುವಟಿಕೆಗಳಲ್ಲಿ ಭಾಗವಹಿಸಲು ಮತ್ತು ಪುಣ್ಯ ಗಳಿಸಲು ಬುಕ್ ಮಾಡಬಹುದಾದ ವಿವಿಧ ಸೇವೆಗಳನ್ನು ನಾವು ನೀಡುತ್ತೇವೆ:",
  sevaItems: [
    "Online Seva Booking - Book sevas conveniently from home",
    "Donation and Annadana Seva",
    "Special Poojas and Archane",
    "Vahanarchane and Ratha Utsava participation"
  ],
  resourcesTitle: "Spiritual Resources",
  resourcesContent: "Access sacred hymns, prayers, and stotrams for your daily worship.",
  visitTitle: "Visit Us",
  address: "No. 05, Kere Cross\nYelahanka Upanagara\nBengaluru – 560064\nKarnataka, India",
  phone: "+91 99002 15389",
  phone2: "+91 98450 79474",
  email: "srimoolaramafoundation@gmail.com",
  communityTitle: "Join Our Community",
  communityContent: "We welcome all devotees to participate in our temple activities, events, and community gatherings.",
  communityContentKannada: "ನಾವು ಎಲ್ಲಾ ಭಕ್ತರನ್ನು ನಮ್ಮ ದೇವಸ್ಥಾನದ ಚಟುವಟಿಕೆಗಳು, ಕಾರ್ಯಕ್ರಮಗಳು ಮತ್ತು ಸಮುದಾಯ ಸಭೆಗಳಲ್ಲಿ ಭಾಗವಹಿಸಲು ಸ್ವಾಗತಿಸುತ್ತೇವೆ.",
  communityQuote: "May we all be protected, nourished, and blessed with strength together.",
  communityQuoteKannada: "ಓಂ ಸಹ ನಾವವತು | ಸಹ ನೌ ಭುನಕ್ತು | ಸಹ ವೀರ್ಯಂ ಕರವಾವಹೈ |"
};

export default function AboutPage() {
  const [data, setData] = useState<AboutUsData>(defaultData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        if (!db) {
          setLoading(false);
          return;
        }
        const docRef = doc(db, "settings", "aboutUs");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData({ ...defaultData, ...docSnap.data() } as AboutUsData);
        }
      } catch (error) {
        console.error("Error loading about us data:", error);
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
      <main className="min-h-[calc(100vh-120px)] bg-gradient-to-b from-amber-50 to-white">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white py-12 px-6">
          <div className="max-w-4xl mx-auto">
            <Breadcrumb current="About Us" />
            <div className="text-center mt-4">
              <div className="inline-block mb-4">
                <p className="text-amber-200 text-sm tracking-widest uppercase">Welcome to</p>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                {data.templeNameKannada}
              </h1>
              <h2 className="text-2xl md:text-3xl font-semibold mb-4">
                {data.tagline}
              </h2>
              <p className="text-amber-100 text-lg">
                {data.tagline2}
              </p>
            </div>
          </div>
        </div>

        {/* Sacred Motto */}
        <div className="bg-stone-900 text-white py-6">
          <div className="max-w-4xl mx-auto text-center space-y-2">
            <p className="text-2xl font-serif tracking-wide">|| ಹರಿ ಸರ್ವೋತ್ತಮ ||</p>
            <p className="text-xl text-amber-300">|| Hari Sarvottama ||</p>
            <p className="text-lg text-stone-400">|| ವಾಯು ಜೀವೋತ್ತಮ ||</p>
            <p className="text-amber-400">|| Vāyu Jīvōttama ||</p>
            <p className="text-lg text-stone-400">|| ಗುರುರಾಜೋ ವಿಜಯತೇ ||</p>
            <p className="text-xl text-amber-300">|| Gururājō Vijayate ||</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
          {/* About Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">{data.aboutTitle}</h2>
            </div>
            
            <div className="prose prose-stone max-w-none space-y-4 text-base leading-8 text-stone-700">
              <p className="whitespace-pre-line">{data.aboutContent}</p>
              {data.aboutContentKannada && (
                <p className="font-serif text-lg text-amber-700 whitespace-pre-line">{data.aboutContentKannada}</p>
              )}
            </div>
          </section>

          {/* Our Activities */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <Calendar className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">{data.activitiesTitle}</h2>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              {data.activities.map((item) => (
                <div key={item.id} className="p-5 bg-white rounded-xl border border-stone-200 shadow-sm">
                  <h3 className="font-semibold text-stone-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-stone-600">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Our Services */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <Heart className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">{data.sevaTitle}</h2>
            </div>
            
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100">
              <p className="text-stone-700 mb-4">{data.sevaContent}</p>
              <ul className="space-y-2 text-stone-700">
                {data.sevaItems.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-orange-600">•</span>
                    {item.includes("Online Seva Booking") ? (
                      <>
                        <Link href="/sevas" className="text-orange-700 hover:underline font-medium">
                          Online Seva Booking
                        </Link>
                        - Book sevas conveniently from home
                      </>
                    ) : (
                      item
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Spiritual Resources */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">{data.resourcesTitle}</h2>
            </div>
            
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-orange-100 to-amber-100 p-4">
                <h3 className="font-semibold text-stone-900">Shlokas & Stotrams</h3>
              </div>
              <div className="p-5">
                <p className="text-stone-600 mb-4">
                  {data.resourcesContent} Our collection includes prayers dedicated to Lord Venkateswara, Sri Raghavendra Swamy, and other deities.
                </p>
                <Link 
                  href="/shlokas"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  View Shlokas Collection
                </Link>
              </div>
            </div>
          </section>

          {/* Visit Us */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <MapPin className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">{data.visitTitle}</h2>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
                <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  Address
                </h3>
                <address className="not-italic text-stone-600 whitespace-pre-line">
                  {data.address}
                </address>
              </div>

              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
                <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-orange-600" />
                  Contact
                </h3>
                <div className="space-y-3 text-stone-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-stone-400" />
                    <span>{data.phone}</span>
                  </div>
                  {data.phone2 && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-stone-400" />
                      <span>{data.phone2}</span>
                    </div>
                  )}
                  {data.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-stone-400" />
                      <a href={`mailto:${data.email}`} className="text-orange-600 hover:underline">
                        {data.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Community */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-100 text-orange-600">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">{data.communityTitle}</h2>
            </div>
            
            <div className="bg-gradient-to-r from-stone-800 to-stone-900 text-white rounded-2xl p-6">
              <p className="text-stone-300 mb-4 whitespace-pre-line">{data.communityContent}</p>
              {data.communityContentKannada && (
                <p className="text-amber-300 font-medium whitespace-pre-line">{data.communityContentKannada}</p>
              )}
              <p className="text-stone-400 text-sm mt-4">
                {data.communityQuote}
              </p>
              {data.communityQuoteKannada && (
                <p className="text-amber-400 text-sm mt-2 font-serif">
                  {data.communityQuoteKannada}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
