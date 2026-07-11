"use client";

import { useState } from "react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CalendarHero from "@/components/calendar/CalendarHero";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import CalendarSearch from "@/components/calendar/CalendarSearch";
import NextEkadashiCard from "@/components/calendar/NextEkadashiCard";
import EkadashiTable from "@/components/calendar/EkadashiTable";

export default function EkadashiPage() {
  const [search, setSearch] = useState("");

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-[#fff8ef] via-white to-[#fffdf8]">

        <CalendarHero
          badge="Temple Calendar"
          title="Ekadashi Schedule"
          subtitle="Sri Parabhava Samvatsara - Sacred Ekadashi Calendar"
        />

        <div className="mx-auto max-w-7xl px-6 py-12">

          <Breadcrumb current="Ekadashi Schedule" parentHref="/calendar" parentName="Temple Calendar" />

          <NextEkadashiCard />

          <div className="my-10 flex items-center justify-between gap-4">

            <CalendarSearch
              value={search}
              onChange={setSearch}
            />

            <button
              onClick={() => window.print()}
              className="rounded-2xl bg-amber-600 px-6 py-3 font-semibold text-white hover:bg-amber-700"
            >
              Print Schedule
            </button>

          </div>

          <EkadashiTable search={search} />

        </div>

      </main>
      <Footer />
    </>
  );
}
