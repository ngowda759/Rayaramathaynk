"use client";

import React from "react";
import { CalendarDays, Sun, MoonStar, Sunrise, Sunset } from "lucide-react";
import { motion } from "framer-motion";
import { useHomepage } from "@/hooks/useHomepage";

// Use CMS-provided panchanga when available. Avoid hardcoded values.
// If CMS doesn't provide values, fall back to temple timings or placeholders.

const DEFAULT_PLACEHOLDER = "—";


export default function Panchanga() {
  const { homepage, loading } = useHomepage();

  const p = homepage?.panchanga ?? {};

  const [live, setLive] = React.useState<null | {
    tithi?: string;
    nakshatra?: string;
    yoga?: string;
    karana?: string;
    sunrise?: string;
    sunset?: string;
  }>(null);

  React.useEffect(() => {
    // Always fetch latest panchanga for current visit; don't block render.
    fetch("/api/panchanga/current")
      .then((r) => r.json())
      .then((json) => {
        if (json && !json.error) setLive(json);
      })
      .catch((err) => console.error("Failed to load live panchanga:", err));
  }, []);

  function getVal(s?: string) {
    if (!s) return DEFAULT_PLACEHOLDER;
    if (typeof s !== "string") return DEFAULT_PLACEHOLDER;
    return s.trim().length === 0 ? DEFAULT_PLACEHOLDER : s;
  }

  const items = [
    {
      title: "Tithi",
      value: getVal(live?.tithi ?? p.tithi),
      icon: MoonStar,
      color: "from-violet-500 to-purple-600",
    },
    {
      title: "Nakshatra",
      value: getVal(live?.nakshatra ?? p.nakshatra),
      icon: CalendarDays,
      color: "from-amber-500 to-orange-500",
    },
    {
      title: "Sunrise",
      value: getVal(live?.sunrise ?? homepage?.morningOpen),
      icon: Sunrise,
      color: "from-orange-500 to-yellow-500",
    },
    {
      title: "Sunset",
      value: getVal(live?.sunset ?? homepage?.eveningClose),
      icon: Sunset,
      color: "from-sky-500 to-indigo-600",
    },
  ];

  // If panchanga is missing, trigger server-side fetch once to populate CMS.
  // This calls our server endpoint which will fetch from the provider and save to Firestore.
  React.useEffect(() => {
    // Only run when homepage exists and panchanga is empty/missing
    if (!homepage) return;

    const p = homepage.panchanga;
    const missing = !p || !p.tithi || p.tithi.trim().length === 0;
    if (!missing) return;

    // fire-and-forget; onSnapshot will update when homepage doc changes
    fetch("/api/panchanga/fetch").catch((err) => {
      console.error("Failed to trigger panchanga fetch:", err);
    });
  }, [homepage]);

  if (loading) {
    return (
      <section className="bg-gradient-to-b from-white to-[#fff9ef] py-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-amber-600 border-t-transparent mx-auto" />
          <p className="mt-5 text-stone-600">Loading Panchanga...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gradient-to-b from-white to-[#fff9ef] py-20">

      <div className="mx-auto max-w-7xl px-6">

        <div className="text-center">

          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            TODAY'S PANCHANGA
          </span>

          <h2 className="mt-5 text-4xl font-bold text-stone-900">
            Daily Panchanga
          </h2>

          <p className="mt-4 text-stone-600">
            Daily Hindu calendar information for devotees.
          </p>

        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

          {items.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="rounded-[30px] border border-amber-100 bg-white p-8 shadow-lg"
              >

                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} text-white`}
                >
                  <Icon size={30} />
                </div>

                <h3 className="mt-6 text-lg font-semibold text-stone-600">
                  {item.title}
                </h3>

                <p className="mt-2 text-3xl font-bold text-stone-900">
                  {item.value}
                </p>

              </motion.div>
            );
          })}

        </div>

        <div className="mt-12 rounded-[30px] bg-gradient-to-r from-amber-600 to-orange-500 p-8 text-center text-white shadow-xl">

          <Sun className="mx-auto" size={40} />

          <h3 className="mt-4 text-3xl font-bold">
            Today's Festival
          </h3>

          <p className="mt-3 text-2xl">
            {getVal(homepage?.featuredFestival)}
          </p>

        </div>

      </div>

    </section>
  );
}
