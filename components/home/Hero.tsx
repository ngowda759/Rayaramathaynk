"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Calendar,
  Clock3,
  Sparkles,
} from "lucide-react";

import TempleButton from "@/components/ui/TempleButton";
import { useHomepage } from "@/hooks/useHomepage";

export default function Hero() {
  const { homepage, loading } = useHomepage();

  if (loading) {
    return (
      <section className="flex h-[90vh] items-center justify-center bg-[#fffaf3]">
        <div className="flex flex-col items-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          <p className="mt-5 text-stone-600">
            Loading Temple...
          </p>
        </div>
      </section>
    );
  }

  const heroTitle =
    homepage?.heroTitle ??
    "Sri Raghavendra Swamy Matha";

  const heroSubtitle =
    homepage?.heroSubtitle ??
    "Serving devotees through Seva, Dharma and Devotion";

  const announcement =
    homepage?.announcement ??
    "Om Sri Raghavendraya Namaha";

  const isTempleOpen = homepage?.isTempleOpen ?? true;
  const templeStatus = isTempleOpen ? "OPEN" : "CLOSED";
  const statusColor = isTempleOpen ? "text-green-600" : "text-red-600";

  const todaySeva = homepage?.todaySeva ?? "Daily Pooja Morning";
  const todaySevaTime = homepage?.todaySevaTime ?? "09:30 AM";

  const featuredFestival = homepage?.featuredFestival ?? "";
  const featuredFestivalDescription = homepage?.featuredFestivalDescription ?? "Coming Soon";

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#fffaf3] via-[#fff7eb] to-[#fdeed6]">

      {/* Temple texture */}

      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "url('/images/Hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Golden Aura */}

      <div className="absolute right-0 top-0 hidden h-full w-1/2 lg:block">

        <div className="absolute right-12 top-32 h-[520px] w-[520px] rounded-full bg-amber-300 blur-[120px] opacity-40" />

      </div>

      <div className="relative mx-auto flex min-h-[92vh] max-w-7xl items-center px-6 lg:px-10">

        <div className="grid w-full items-center gap-10 lg:grid-cols-2">

          {/* LEFT */}

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >

            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">

              <Sparkles size={16} />

              {announcement}

            </div>

            <h1 className="mt-8 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-stone-900">

              {heroTitle}

            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">

              {heroSubtitle}

            </p>

            <div className="mt-10 flex flex-wrap gap-4">

              <TempleButton href="/sevas">

                Book Seva

              </TempleButton>

              <TempleButton
                href="/calendar"
                variant="outline"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Festivities
              </TempleButton>

              <TempleButton
                href="/events"
                variant="outline"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Events
              </TempleButton>

            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">

              <div className="rounded-3xl border border-amber-200 bg-white/70 p-5 backdrop-blur">

                <div className="mb-3 flex items-center gap-2">

                  <Clock3 className="text-amber-600" size={18} />

                  <span className="font-semibold text-stone-900">
                    Temple Timings
                  </span>

                </div>

                <p className={`text-2xl font-bold ${statusColor}`}>
                  {templeStatus}
                </p>

                <div className="mt-2 space-y-1">
                  <p className="text-sm text-stone-600">
                    Morning: {homepage?.morningOpen ?? "06:00 AM"} - {homepage?.morningClose ?? "01:00 PM"}
                  </p>
                  <p className="text-sm text-stone-600">
                    Evening: {homepage?.eveningOpen ?? "04:00 PM"} - {homepage?.eveningClose ?? "08:00 PM"}
                  </p>
                </div>

              </div>

              <div className="rounded-3xl border border-amber-200 bg-white/70 p-5 backdrop-blur">

                <div className="mb-3 flex items-center gap-2">

                  <CalendarDays className="text-amber-600" size={18} />

                  <span className="font-semibold text-stone-900">
                    Today&apos;s Seva
                  </span>

                </div>

                <p className="text-lg font-semibold text-stone-900">
                  {todaySeva}
                </p>

                <p className="mt-2 text-sm text-stone-600">
                  {todaySevaTime}
                </p>

              </div>

              <div className="rounded-3xl border border-amber-200 bg-white/70 p-5 backdrop-blur">

                <div className="mb-3 flex items-center gap-2">

                  <Sparkles className="text-amber-600" size={18} />

                  <span className="font-semibold text-stone-900">
                    Festival
                  </span>

                </div>

                <p className="text-lg font-semibold text-stone-900">
                  {featuredFestival || "No Festival"}
                </p>

                <p className="mt-2 text-sm text-stone-600">
                  {featuredFestivalDescription}
                </p>

              </div>

            </div>

            <div className="mt-14 flex flex-wrap gap-10">

              <div>

                <h2 className="text-4xl font-bold text-amber-600">
                  Daily
                </h2>

                <p className="mt-2 text-stone-600">
                  Pooja
                </p>

              </div>

              <div>

                <h2 className="text-4xl font-bold text-amber-600">
                  365
                </h2>

                <p className="mt-2 text-stone-600">
                  Days of Seva
                </p>

              </div>

              <div>

                <h2 className="text-4xl font-bold text-amber-600">
                  Guru
                </h2>

                <p className="mt-2 text-stone-600">
                  Blessings
                </p>

              </div>

            </div>

          </motion.div>

          {/* RIGHT */}

          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1 }}
            className="relative hidden lg:flex justify-center"
          >

            <div className="absolute h-[520px] w-[520px] rounded-full bg-amber-300 blur-[140px] opacity-40" />

            <div className="relative z-10 h-[760px] w-[520px] overflow-hidden rounded-lg shadow-2xl">
              <Image
                src="/images/Hero.jpg"
                alt="Temple Hero"
                fill
                priority
                sizes="520px"
                className="object-cover"
              />
            </div>

          </motion.div>

        </div>

      </div>

            {/* Scroll Indicator */}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="flex flex-col items-center gap-2">

          <span className="text-xs font-medium uppercase tracking-[0.3em] text-stone-500">
            Scroll
          </span>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
          >
            <ArrowRight
              size={24}
              className="rotate-90 text-amber-600"
            />
          </motion.div>

        </div>
      </motion.div>

    </section>
  );
}
