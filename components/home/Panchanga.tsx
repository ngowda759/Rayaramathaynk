"use client";

import React from "react";
import {
  CalendarDays,
  Sun,
  MoonStar,
  Sunrise,
  Sunset,
} from "lucide-react";
import { motion } from "framer-motion";
import { useHomepage } from "@/hooks/useHomepage";

const DEFAULT_PLACEHOLDER = "—";

type PanchangaShape = {
  tithi?: string;
  nakshatra?: string;
  yoga?: string;
  karana?: string;
  sunrise?: string;
  sunset?: string;
};

type LivePanchanga = {
  tithi?: string;
  nakshatra?: string;
  yoga?: string;
  karana?: string;
  sunrise?: string;
  sunset?: string;
};

export default function Panchanga() {
  const { homepage, loading } = useHomepage();

  const cms = (homepage?.panchanga ?? {}) as PanchangaShape;

  const [live, setLive] = React.useState<LivePanchanga | null>(
    null
  );

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          "/data/panchanga/current.json",
          {
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (!json || json.error) return;

        setLive({
          tithi: json.tithi?.name,
          nakshatra: json.nakshatra?.name,
          yoga: json.yoga?.name,
          karana: json.karana?.name,

          sunrise: json.sun?.sunrise
            ? new Date(
                json.sun.sunrise
              ).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,

          sunset: json.sun?.sunset
            ? new Date(
                json.sun.sunset
              ).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
        });
      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, []);

  function value(v?: string) {
    if (!v) return DEFAULT_PLACEHOLDER;

    if (v.trim().length === 0)
      return DEFAULT_PLACEHOLDER;

    return v;
  }

  const items = [
    {
      title: "Tithi",
      value: value(live?.tithi ?? cms.tithi),
      icon: MoonStar,
      color: "from-violet-500 to-purple-600",
    },
    {
      title: "Nakshatra",
      value: value(live?.nakshatra ?? cms.nakshatra),
      icon: CalendarDays,
      color: "from-amber-500 to-orange-500",
    },
    {
      title: "Sunrise",
      value: value(
        live?.sunrise ??
          cms.sunrise ??
          homepage?.morningOpen
      ),
      icon: Sunrise,
      color: "from-orange-500 to-yellow-500",
    },
    {
      title: "Sunset",
      value: value(
        live?.sunset ??
          cms.sunset ??
          homepage?.eveningClose
      ),
      icon: Sunset,
      color: "from-sky-500 to-indigo-600",
    },
  ];

    if (loading) {
    return (
      <section className="bg-gradient-to-b from-white to-[#fff9ef] py-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          <p className="mt-5 text-stone-600">
            Loading Panchanga...
          </p>
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

                <p className="mt-2 text-3xl font-bold text-stone-900 break-words">
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
            {value(homepage?.featuredFestival)}
          </p>
        </div>
      </div>
    </section>
  );
}
