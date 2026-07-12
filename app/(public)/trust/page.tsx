"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import { Users, Sparkles } from "lucide-react";

interface CommitteeMember {
  id: string;
  name: string;
  nameKannada: string;
  role: string;
  roleKannada: string;
  imageUrl: string;
  order: number;
  isActive: boolean;
}

interface TrustCommitteeData {
  heading: string;
  headingKannada: string;
  subheading: string;
  subheadingKannada: string;
  members: CommitteeMember[];
}

const defaultData: TrustCommitteeData = {
  heading: "Trust Committee",
  headingKannada: "ಟ್ರಸ್ಟ್ ಸಮಿತಿ",
  subheading: "Meet the dedicated team behind Sri Raghavendra Swamy Matha",
  subheadingKannada: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠದ ಹಿಂದೆ ಇರುವ ಸಮರ್ಪಣೆಯ ತಂಡವನ್ನು ಭೇಟಿಯಾಗಿ",
  members: [
    {
      id: "1",
      name: "Committee Members",
      nameKannada: "ಸಮಿತಿ ಸದಸ್ಯರು",
      role: "Sri Raghavendra Swamy Matha",
      roleKannada: "ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ",
      imageUrl: "/images/raghavendra_swamy.png",
      order: 1,
      isActive: true,
    },
  ],
};

export default function TrustCommitteePage() {
  const [data, setData] = useState<TrustCommitteeData>(defaultData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        if (!db) {
          setLoading(false);
          return;
        }
        const docRef = doc(db, "settings", "trustCommittee");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData({ ...defaultData, ...docSnap.data() } as TrustCommitteeData);
        }
      } catch (error) {
        console.error("Error loading trust committee data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activeMembers = data.members
    .filter((m) => m.isActive)
    .sort((a, b) => a.order - b.order);

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
            <Breadcrumb current="Trust Committee" />
            <div className="text-center mt-4">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 backdrop-blur">
                <Sparkles className="h-5 w-5 text-amber-200" />
                <span className="text-sm font-medium text-white">Dedicated Service</span>
              </div>

              <h1 className="text-4xl font-bold text-white md:text-5xl">
                {data.heading}
              </h1>
              <p className="mx-auto mt-4 text-2xl text-amber-100 font-serif">
                {data.headingKannada}
              </p>
              <p className="mx-auto mt-6 max-w-3xl text-xl text-amber-100">
                {data.subheading}
              </p>
              <p className="mx-auto mt-2 max-w-3xl text-lg text-amber-200 font-serif">
                {data.subheadingKannada}
              </p>
            </div>
          </div>
        </section>

        {/* Devotional Quote */}
        <section className="bg-gradient-to-b from-amber-50 to-white px-6 py-12">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-2xl font-serif italic text-amber-800">
              ನಂಬಿ ಕೆಟ್ಟವರಿಲ್ಲವೋ ಈ ಗುರುಗಳ
            </p>
            <p className="mt-2 text-lg text-stone-600">
              There is none as kind as our Guru
            </p>
          </div>
        </section>

        {/* Committee Members */}
        <section className="px-6 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            {activeMembers.length > 0 ? (
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {activeMembers.map((member) => (
                  <div
                    key={member.id}
                    className="group relative overflow-hidden rounded-3xl border border-amber-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-xl"
                  >
                    {/* Image */}
                    <div className="mx-auto mb-6 h-48 w-48 overflow-hidden rounded-full border-4 border-amber-200 bg-amber-50">
                      {member.imageUrl ? (
                        <Image
                          src={member.imageUrl}
                          alt={member.name}
                          width={192}
                          height={192}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Users className="h-16 w-16 text-amber-300" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-stone-900">
                        {member.name}
                      </h3>
                      <p className="mt-1 font-serif text-lg text-amber-600">
                        {member.nameKannada}
                      </p>
                      <div className="mt-4 rounded-full bg-amber-50 px-4 py-2">
                        <p className="text-sm font-semibold text-stone-700">
                          {member.role}
                        </p>
                        <p className="mt-1 font-serif text-sm text-amber-600">
                          {member.roleKannada}
                        </p>
                      </div>
                    </div>

                    {/* Decorative Element */}
                    <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 opacity-50 blur-2xl" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-stone-500">
                Committee information will be updated soon.
              </div>
            )}
          </div>
        </section>

        {/* Join Section */}
        <section className="px-6 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <div className="rounded-3xl bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 p-12 text-white">
              <Users className="mx-auto h-16 w-16 text-amber-200" />
              <h2 className="mt-6 text-3xl font-bold">Get Involved</h2>
              <p className="mt-4 text-lg text-amber-100">
                Join our dedicated team of volunteers and contribute to the
                preservation and propagation of our sacred traditions.
              </p>
              <a
                href="/contact"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-amber-700 transition hover:scale-105 hover:bg-amber-50"
              >
                Contact Us
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
