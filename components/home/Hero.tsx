"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  CalendarDays,
  Heart,
  Sparkles,
} from "lucide-react";
import { useHomepage } from "@/hooks/useHomepage";

export default function Hero() {
  const { homepage, loading } = useHomepage();

  if (loading) {
    return (
      <section className="flex h-[90vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="mt-6 text-stone-600">Loading Temple Information...</p>
        </div>
      </section>
    );
  }

  const heroTitle =
    homepage?.heroTitle ?? "Sri Raghavendra Swamy Temple";

  const heroSubtitle =
    homepage?.heroSubtitle ??
    "A Sacred Place of Devotion";

  const heroImage =
    homepage?.heroImage ??
    "/images/hero.jpg";

  const announcement =
    homepage?.announcement ??
    "Welcome to Sri Rayara Matha";

  return (
    <section className="relative h-[92vh] min-h-[720px] overflow-hidden">

      <Image
        src={heroImage}
        alt={heroTitle}
        fill
        priority
        className="object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />

      <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-b from-black/10 via-transparent to-black/20" />

      <div className="relative z-10 flex h-full items-center">

        <div className="mx-auto max-w-7xl px-6">

          <div className="max-w-3xl">

            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-5 py-2 text-amber-200 backdrop-blur">

              <Sparkles size={16} />

              {announcement}

            </div>

            <h1 className="mt-8 text-5xl font-bold leading-tight text-white md:text-7xl">
              {heroTitle}
            </h1>

            <p className="mt-8 text-xl leading-8 text-gray-200">
              {heroSubtitle}
            </p>

            <div className="mt-10 flex flex-wrap gap-4">

              <Link
                href="/sevas"
                className="rounded-xl bg-amber-600 px-8 py-4 font-semibold text-white transition hover:bg-amber-700"
              >
                Book Seva
              </Link>

              <Link
                href="/donation"
                className="flex items-center gap-2 rounded-xl bg-white px-8 py-4 font-semibold text-stone-900 transition hover:bg-stone-100"
              >
                <Heart size={18} />
                Donate
              </Link>

              <Link
                href="/events"
                className="flex items-center gap-2 rounded-xl border border-white/40 px-8 py-4 font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                <CalendarDays size={18} />
                Events
              </Link>

            </div>

            <div className="mt-12 grid grid-cols-3 gap-8 text-white">

              <div>

                <p className="text-3xl font-bold text-amber-300">
                  100+
                </p>

                <p className="text-gray-300">
                  Years
                </p>

              </div>

              <div>

                <p className="text-3xl font-bold text-amber-300">
                  365
                </p>

                <p className="text-gray-300">
                  Days of Seva
                </p>

              </div>

              <div>

                <p className="text-3xl font-bold text-amber-300">
                  50K+
                </p>

                <p className="text-gray-300">
                  Devotees
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white">
        <ArrowDown size={28} />
      </div>

    </section>
  );
}
