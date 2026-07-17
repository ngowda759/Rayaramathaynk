"use client";

import Image from "next/image";
import { motion, useTransform, MotionValue } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  Calendar,
  GraduationCap,
  BookOpen,
  Images,
  Star,
} from "lucide-react";
import { useRef, useState, useEffect, useMemo } from "react";

import TempleButton from "@/components/ui/TempleButton";
import { useHomepage } from "@/hooks/useHomepage";
import { DeepaFlame } from "@/components/ui/DeepaFlame";
import { FloatingParticles, FloatingDots } from "@/components/ui/FloatingParticles";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export default function Hero() {
  const { homepage, loading } = useHomepage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const reducedMotion = useReducedMotion();
  
  // Create MotionValue using useMemo to avoid initialization during render
  const scrollYProgress = useMemo(() => new MotionValue(0), []);
  
  useEffect(() => {
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
    // Mark as mounted after initial setup
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    
    return () => {
      window.removeEventListener('scroll', updateScroll);
    };
  }, [scrollYProgress]);

  const heroImageY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

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
      {/* Floating particles background */}
      {!reducedMotion && (
        <>
          <FloatingParticles
            count={25}
            className="opacity-40"
            color="rgba(251, 191, 36, 0.5)"
            minSize={2}
            maxSize={5}
            speed={0.2}
          />
          <FloatingDots count={15} size={3} color="rgba(255, 180, 50, 0.4)" />
        </>
      )}

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

      <div className="relative mx-auto flex min-h-[92vh] max-w-7xl items-center px-6 lg:px-10">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2">
          {/* LEFT */}
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.8 }}
          >
            <motion.div
              initial={reducedMotion ? {} : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reducedMotion ? 0 : 0.2 }}
              className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700"
            >
              <Star size={16} className="fill-amber-500" />
              {announcement}
            </motion.div>

            <motion.h1
              initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.3, duration: 0.6 }}
              className="mt-8 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-stone-900"
            >
              {heroTitle}
            </motion.h1>

            <motion.p
              initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.4, duration: 0.6 }}
              className="mt-6 max-w-xl text-lg leading-8 text-stone-600"
            >
              {heroSubtitle}
            </motion.p>

            <motion.div
              initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.5, duration: 0.6 }}
              className="mt-10 flex flex-wrap gap-4"
            >
              <TempleButton href="/aaradhane" size="lg">
                Aaradhane
              </TempleButton>

              <TempleButton href="/guruparampara" variant="outline" size="lg">
                <GraduationCap className="mr-2 h-5 w-5" />
                Guru Parampara
              </TempleButton>

              <TempleButton href="/shlokas" variant="outline" size="lg">
                <BookOpen className="mr-2 h-5 w-5" />
                Shlokas
              </TempleButton>

              <TempleButton href="/gallery" variant="outline" size="lg">
                <Images className="mr-2 h-5 w-5" />
                Gallery
              </TempleButton>
            </motion.div>

            <motion.div
              initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.6, duration: 0.6 }}
              className="mt-6 flex flex-wrap gap-4"
            >
              <TempleButton href="/calendar" variant="outline" size="md">
                <Calendar className="mr-2 h-4 w-4" />
                Festivities
              </TempleButton>

              <TempleButton href="/events" variant="outline" size="md">
                <CalendarDays className="mr-2 h-4 w-4" />
                Events
              </TempleButton>
            </motion.div>

            <motion.div
              initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : 0.7, duration: 0.6 }}
              className="mt-14 flex flex-wrap gap-10"
            >
              <div>
                <h2 className="text-4xl font-bold text-amber-600">Daily</h2>
                <p className="mt-2 text-stone-600">Pooja</p>
              </div>

              <div>
                <h2 className="text-4xl font-bold text-amber-600">365</h2>
                <p className="mt-2 text-stone-600">Days of Seva</p>
              </div>

              <div>
                <h2 className="text-4xl font-bold text-amber-600">Guru</h2>
                <p className="mt-2 text-stone-600">Blessings</p>
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT */}
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reducedMotion ? 0 : 1 }}
            className="relative flex justify-center"
            style={isMounted && !reducedMotion ? { opacity: heroOpacity } : { opacity: 1 }}
          >
            {/* Enhanced glow */}
            <div className="absolute h-[520px] w-[520px] rounded-full bg-gradient-to-br from-amber-300 via-orange-200 to-amber-400 blur-[140px] opacity-60 animate-pulse-ring" />

            {/* Parallax Image Container with ornate frame */}
            <motion.div
              style={isMounted && !reducedMotion ? { y: heroImageY } : { y: 0 }}
              className="relative z-10 group hidden md:block"
            >
              {/* Ornate golden frame */}
              <div className="absolute -inset-2 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 rounded-2xl opacity-60 shadow-lg shadow-amber-500/30" />
              <div className="absolute -inset-1 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 rounded-xl" />
              
              {/* Main image */}
              <div className="relative h-[500px] w-[340px] overflow-hidden rounded-xl shadow-2xl lg:h-[700px] lg:w-[480px]">
                <Image
                  src={heroImage}
                  alt="Temple Hero"
                  fill
                  priority
                  sizes="(max-width: 768px) 340px, 480px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                
                {/* Glowing border overlay */}
                <div className="absolute inset-0 rounded-xl ring-1 ring-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
              </div>
            </motion.div>

            {/* Realistic Deepa Flames with Canvas Animation */}
            {/* Left Flame */}
            {!reducedMotion && (
              <motion.div
                animate={{
                  y: [-3, 4, -3],
                  opacity: [0.85, 1, 0.85],
                }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -left-16 top-[38%] hidden lg:block"
                aria-hidden="true"
              >
                <DeepaFlame size="lg" enableSparks glowIntensity="medium" />
              </motion.div>
            )}

            {/* Right Flame */}
            {!reducedMotion && (
              <motion.div
                animate={{
                  y: [4, -3, 4],
                  opacity: [0.85, 1, 0.85],
                }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
                className="absolute -right-16 top-[38%] hidden lg:block"
                aria-hidden="true"
              >
                <DeepaFlame size="lg" enableSparks glowIntensity="medium" />
              </motion.div>
            )}

            {/* Static glow for reduced motion */}
            {reducedMotion && (
              <>
                <div className="absolute -left-16 top-[38%] hidden lg:block">
                  <DeepaFlame size="lg" enableSparks={false} glowIntensity="medium" />
                </div>
                <div className="absolute -right-16 top-[38%] hidden lg:block">
                  <DeepaFlame size="lg" enableSparks={false} glowIntensity="medium" />
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reducedMotion ? 0 : 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-stone-500">
            Scroll
          </span>

          <motion.div
            animate={reducedMotion ? {} : { y: [0, 10, 0] }}
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
