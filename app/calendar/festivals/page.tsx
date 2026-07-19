"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CalendarHero from "@/components/calendar/CalendarHero";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import FestivalExperience from "@/components/festival/FestivalExperience";
import { getAllFestivals } from "@/lib/festival-utils";

export default function FestivalsPage() {
  const festivals = getAllFestivals();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-[#fff8ef] via-white to-[#fffdf8]">

        <CalendarHero
          badge="Temple Calendar"
          title="Festival Calendar"
          subtitle="Sri Parabhava Samvatsara - Major Festivals Celebrated at Sri Raghavendra Swamy Matha"
        />

        <div className="mx-auto max-w-7xl px-6 py-12">

          <Breadcrumb current="Festival Calendar" parentHref="/calendar" parentName="Temple Calendar" />

          <div className="mt-8">
            <FestivalExperience festivals={festivals} />
          </div>

        </div>

      </main>
      <Footer />
    </>
  );
}
