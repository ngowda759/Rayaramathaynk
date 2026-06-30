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
      <section className="flex h-[90vh] items-center justify-center bg-stone-900">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="mt-5 text-white">Loading...</p>
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
    <section className="relative min-h-[92vh] overflow-hidden">

      {/* Background */}

      <Image
        src={heroImage}
        alt={heroTitle}
        fill
        priority
        className="object-cover object-right"
      />

      {/* Better Overlay */}

      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />

      {/* Content */}

      <div className="relative z-10 flex min-h-[92vh] items-center">

        <div className="mx-auto w-full max-w-7xl px-6 lg:px-12">

          <div className="grid lg:grid-cols-2">

            {/* LEFT SIDE */}

            <div className="max-w-xl">

              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-5 py-2 text-amber-200 backdrop-blur">

                <Sparkles size={16} />

                {announcement}

              </div>

              <h1 className="mt-8 text-left text-5xl font-bold leading-tight text-white md:text-6xl">

                {heroTitle}

              </h1>

              <p className="mt-6 max-w-lg text-left text-lg leading-8 text-gray-200">

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
                  className="flex items-center gap-2 rounded-xl border border-white/30 px-8 py-4 font-semibold text-white backdrop-blur transition hover:bg-white/10"
                >
                  <CalendarDays size={18} />
                  Events
                </Link>

              </div>

              <div className="mt-14 grid grid-cols-3 gap-8">

                <div>

                  <h2 className="text-3xl font-bold text-amber-300">
                    100+
                  </h2>

                  <p className="mt-2 text-gray-300">
                    Years
                  </p>

                </div>

                <div>

                  <h2 className="text-3xl font-bold text-amber-300">
                    365
                  </h2>

                  <p className="mt-2 text-gray-300">
                    Days of Seva
                  </p>

                </div>

                <div>

                  <h2 className="text-3xl font-bold text-amber-300">
                    50K+
                  </h2>

                  <p className="mt-2 text-gray-300">
                    Devotees
                  </p>

                </div>

              </div>

            </div>

            {/* RIGHT SIDE */}

            <div />

          </div>

        </div>

      </div>

      {/* Scroll */}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">

        <ArrowDown className="text-white" size={28} />

      </div>

    </section>
  );
}
