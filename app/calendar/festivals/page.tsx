"use client";

import { useState } from "react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CalendarHero from "@/components/calendar/CalendarHero";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import CalendarSearch from "@/components/calendar/CalendarSearch";
import FestivalTable from "@/components/calendar/FestivalTable";

export default function FestivalsPage() {
  const [search, setSearch] = useState("");

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

          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <CalendarSearch
              value={search}
              onChange={setSearch}
            />

            <div className="rounded-2xl bg-orange-100 px-6 py-3 font-semibold text-orange-700">
              {search
                ? "Filtered Results"
                : `${28} Major Festivals`}
            </div>

          </div>

          <FestivalTable search={search} />

        </div>

      </main>
      <Footer />
    </>
  );
}
