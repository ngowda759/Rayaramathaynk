"use client";

import Image from "next/image";
import { motion, useTransform, MotionValue } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Calendar,
  Clock3,
  Sparkles,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";

import TempleButton from "@/components/ui/TempleButton";
import { useHomepage } from "@/hooks/useHomepage";

export default function Hero() {
  const { homepage, loading } = useHomepage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const scrollYProgress = useRef(new MotionValue(0)).current;
  
  useEffect(() => {
    setIsMounted(true);
    
    // Set up scroll tracking after mounting to avoid hydration errors
    const updateScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const elementTop = rect.top;
        const elementHeight = rect.height;
        
        // Calculate progress based on element position
        const start = elementTop;
        const end = elementTop + elementHeight - windowHeight;
        const progress = Math.max(0, Math.min(1, -start / (end - start)));
        scrollYProgress.set(progress);
      }
    };
    
    window.addEventListener('scroll', updateScroll, { passive: true });
    updateScroll();
    
    return () => {
      window.removeEventListener('scroll', updateScroll);
    };
  }, [scrollYProgress]);

  const heroImageY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  if (loading) {
    return (
      <section className="flex h-[90vh] items-center justify-center bg-sacred-gradient">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-amber-300 border-t-transparent" />
            <div className="absolute inset-0 animate-ping rounded-full border-2 border-amber-400 opacity-20" />
          </div>
          <p className="mt-6 text-lg text-stone-600 font-medium">
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

  const heroImage = homepage?.heroImage || "/images/Hero.jpg";

  const isTempleOpen = homepage?.isTempleOpen ?? true;
  const templeStatus = isTempleOpen ? "OPEN" : "CLOSED";
  const statusColor = isTempleOpen ? "text-green-600" : "text-red-600";

  const todaySeva = homepage?.todaySeva ?? "Daily Pooja Morning";
  const todaySevaTime = homepage?.todaySevaTime ?? "09:30 AM";

  const featuredFestival = homepage?.featuredFestival ?? "";
  const featuredFestivalDescription = homepage?.featuredFestivalDescription ?? "Coming Soon";

  return (
    <section ref={containerRef} className="relative overflow-hidden bg-sacred-gradient">

      {/* Temple texture */}

      <div
        className="absolute inset-0 opacity-[0.04] sacred-pattern"
        style={{
          backgroundImage: `url('${heroImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Golden Aura */}

      <div className="absolute right-0 top-0 hidden h-full w-1/2 lg:block">

        <div className="absolute right-12 top-32 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-amber-300 via-orange-200 to-amber-400 blur-[120px] opacity-50 animate-pulse-ring" />

      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-amber-400/30"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        ))}
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

              <TempleButton href="/aaradhane">

                Aaradhane

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

              <motion.div
                whileHover={{ y: -4 }}
                className="rounded-3xl border border-amber-200/60 bg-white/80 p-5 backdrop-blur-xl shadow-lg transition-all hover:shadow-xl hover:border-amber-300/80"
              >

                <div className="mb-3 flex items-center gap-2">

                  <div className="rounded-lg bg-amber-100 p-2">
                    <Clock3 className="text-amber-600" size={18} />
                  </div>

                  <span className="font-semibold text-stone-900">
                    Temple Timings
                  </span>

                </div>

                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${statusColor}`}>
                    {templeStatus}
                  </p>
                  {isTempleOpen && (
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
                  <p className="text-sm text-stone-600">
                    <span className="font-medium">Morning:</span> {homepage?.morningOpen ?? "06:00 AM"} - {homepage?.morningClose ?? "01:00 PM"}
                  </p>
                  <p className="text-sm text-stone-600">
                    <span className="font-medium">Evening:</span> {homepage?.eveningOpen ?? "04:00 PM"} - {homepage?.eveningClose ?? "08:00 PM"}
                  </p>
                </div>

              </motion.div>

              <motion.div
                whileHover={{ y: -4 }}
                className="rounded-3xl border border-amber-200/60 bg-white/80 p-5 backdrop-blur-xl shadow-lg transition-all hover:shadow-xl hover:border-amber-300/80"
              >

                <div className="mb-3 flex items-center gap-2">

                  <div className="rounded-lg bg-amber-100 p-2">
                    <CalendarDays className="text-amber-600" size={18} />
                  </div>

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

              </motion.div>

              <motion.div
                whileHover={{ y: -4 }}
                className="rounded-3xl border border-amber-200/60 bg-white/80 p-5 backdrop-blur-xl shadow-lg transition-all hover:shadow-xl hover:border-amber-300/80"
              >

                <div className="mb-3 flex items-center gap-2">

                  <div className="rounded-lg bg-amber-100 p-2">
                    <Sparkles className="text-amber-600" size={18} />
                  </div>

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

              </motion.div>

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
            style={isMounted ? { opacity: heroOpacity } : { opacity: 1 }}
          >

            {/* Enhanced glow */}
            <div className="absolute h-[520px] w-[520px] rounded-full bg-gradient-to-br from-amber-300 via-orange-200 to-amber-400 blur-[140px] opacity-60 animate-pulse-ring" />

            {/* Parallax Image Container with ornate frame */}
            <motion.div
              style={isMounted ? { y: heroImageY } : { y: 0 }}
              className="relative z-10 group"
            >
              {/* Ornate golden frame */}
              <div className="absolute -inset-4 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 rounded-2xl opacity-50 blur-sm" />
              <div className="absolute -inset-3 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 rounded-xl" />
              
              {/* Main image */}
              <div className="relative h-[700px] w-[480px] overflow-hidden rounded-xl shadow-2xl">
                <Image
                  src={heroImage}
                  alt="Temple Hero"
                  fill
                  priority
                  sizes="480px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                
                {/* Glowing border overlay */}
                <div className="absolute inset-0 rounded-xl ring-2 ring-amber-400/40" />
              </div>
            </motion.div>

            {/* Deepa (Lamp) decorations with realistic glow */}
            <motion.div
              animate={{
                y: [-8, 12, -8],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute -left-16 top-1/4"
            >
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 blur-2xl bg-amber-300/50 animate-pulse" />
                <div className="absolute inset-0 blur-xl bg-orange-400/40" />
                {/* Deepa Lamp SVG */}
                <svg className="relative h-20 w-20 drop-shadow-lg" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Lamp base */}
                  <ellipse cx="50" cy="110" rx="35" ry="8" fill="#CD7F32"/>
                  <path d="M15 110 L20 95 L80 95 L85 110" fill="#B8860B"/>
                  <path d="M20 95 L25 85 L75 85 L80 95" fill="#DAA520"/>
                  {/* Lamp bowl */}
                  <path d="M25 85 C25 75, 35 60, 50 60 C65 60, 75 75, 75 85 Z" fill="#CD7F32"/>
                  <ellipse cx="50" cy="85" rx="25" ry="6" fill="#B8860B"/>
                  {/* Oil surface */}
                  <ellipse cx="50" cy="75" rx="18" ry="4" fill="#8B4513"/>
                  {/* Flame */}
                  <path d="M50 15 C45 30, 38 45, 42 55 C44 58, 46 58, 48 55 C48 50, 46 45, 50 40 C54 45, 52 50, 52 55 C54 58, 56 58, 58 55 C62 45, 55 30, 50 15" fill="url(#flameGradient1)"/>
                  <path d="M50 25 C47 35, 44 45, 46 52 C47 54, 48 54, 49 52 C49 48, 48 45, 50 42 C52 45, 51 48, 51 52 C52 54, 53 54, 54 52 C56 45, 53 35, 50 25" fill="url(#flameGradient2)"/>
                  <ellipse cx="50" cy="28" rx="4" ry="6" fill="#FFFACD"/>
                  <defs>
                    <linearGradient id="flameGradient1" x1="50" y1="55" x2="50" y2="15" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FF4500"/>
                      <stop offset="50%" stopColor="#FFA500"/>
                      <stop offset="100%" stopColor="#FFD700"/>
                    </linearGradient>
                    <linearGradient id="flameGradient2" x1="50" y1="52" x2="50" y2="25" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FFA500"/>
                      <stop offset="100%" stopColor="#FFFFE0"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </motion.div>

            <motion.div
              animate={{
                y: [12, -8, 12],
                opacity: [0.6, 0.95, 0.6],
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.8,
              }}
              className="absolute -right-20 top-1/3"
            >
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 blur-2xl bg-amber-400/40 animate-pulse" />
                <div className="absolute inset-0 blur-xl bg-yellow-500/30" />
                {/* Deepa Lamp SVG - smaller */}
                <svg className="relative h-16 w-16 drop-shadow-lg" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Lamp base */}
                  <ellipse cx="50" cy="110" rx="35" ry="8" fill="#CD7F32"/>
                  <path d="M15 110 L20 95 L80 95 L85 110" fill="#B8860B"/>
                  <path d="M20 95 L25 85 L75 85 L80 95" fill="#DAA520"/>
                  {/* Lamp bowl */}
                  <path d="M25 85 C25 75, 35 60, 50 60 C65 60, 75 75, 75 85 Z" fill="#CD7F32"/>
                  <ellipse cx="50" cy="85" rx="25" ry="6" fill="#B8860B"/>
                  {/* Oil surface */}
                  <ellipse cx="50" cy="75" rx="18" ry="4" fill="#8B4513"/>
                  {/* Flame */}
                  <path d="M50 15 C45 30, 38 45, 42 55 C44 58, 46 58, 48 55 C48 50, 46 45, 50 40 C54 45, 52 50, 52 55 C54 58, 56 58, 58 55 C62 45, 55 30, 50 15" fill="url(#flameGradient3)"/>
                  <path d="M50 25 C47 35, 44 45, 46 52 C47 54, 48 54, 49 52 C49 48, 48 45, 50 42 C52 45, 51 48, 51 52 C52 54, 53 54, 54 52 C56 45, 53 35, 50 25" fill="url(#flameGradient4)"/>
                  <ellipse cx="50" cy="28" rx="4" ry="6" fill="#FFFACD"/>
                  <defs>
                    <linearGradient id="flameGradient3" x1="50" y1="55" x2="50" y2="15" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FF4500"/>
                      <stop offset="50%" stopColor="#FFA500"/>
                      <stop offset="100%" stopColor="#FFD700"/>
                    </linearGradient>
                    <linearGradient id="flameGradient4" x1="50" y1="52" x2="50" y2="25" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FFA500"/>
                      <stop offset="100%" stopColor="#FFFFE0"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </motion.div>

            {/* Decorative corner ornaments */}
            <div className="absolute -top-4 -right-4 text-amber-500/50 text-4xl">✦</div>
            <div className="absolute -bottom-4 -left-4 text-amber-500/50 text-4xl">✦</div>

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
