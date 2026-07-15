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

export default function Hero() {
  const { homepage, loading } = useHomepage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  
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
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >

            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">

              <Star size={16} className="fill-amber-500" />

              {announcement}

            </div>

            <h1 className="mt-8 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-stone-900">

              {heroTitle}

            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">

              {heroSubtitle}

            </p>

            <div className="mt-10 flex flex-wrap gap-4">

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

            </div>

            <div className="mt-6 flex flex-wrap gap-4">

              <TempleButton href="/calendar" variant="outline" size="md">
                <Calendar className="mr-2 h-4 w-4" />
                Festivities
              </TempleButton>

              <TempleButton href="/events" variant="outline" size="md">
                <CalendarDays className="mr-2 h-4 w-4" />
                Events
              </TempleButton>

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
            className="relative flex justify-center"
            style={isMounted ? { opacity: heroOpacity } : { opacity: 1 }}
          >

            {/* Enhanced glow */}
            <div className="absolute h-[520px] w-[520px] rounded-full bg-gradient-to-br from-amber-300 via-orange-200 to-amber-400 blur-[140px] opacity-60 animate-pulse-ring" />

            {/* Parallax Image Container with ornate frame */}
            <motion.div
              style={isMounted ? { y: heroImageY } : { y: 0 }}
              className="relative z-10 group hidden md:block"
            >
              {/* Ornate golden frame - 4-5px border */}
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
                
                {/* Glowing border overlay - subtle golden glow */}
                <div className="absolute inset-0 rounded-xl ring-1 ring-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
              </div>
            </motion.div>

            {/* Deepa (Lamp) decorations - identical on both sides */}
            {/* Left Lamp */}
            <motion.div
              animate={{
                y: [-2, 3, -2],
                opacity: [0.8, 1, 0.8],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute -left-8 top-[42%] hidden lg:block"
              aria-hidden="true"
            >
              <div className="relative">
                {/* Soft golden glow effect - layered for depth */}
                <div className="absolute inset-0 -m-4 rounded-full bg-amber-400/25 blur-2xl animate-pulse" />
                <div className="absolute inset-0 -m-2 rounded-full bg-orange-300/20 blur-xl" />
                {/* Deepa Lamp SVG - transparent background with soft golden glow */}
                <Image
                  src="/images/deepa.svg"
                  alt=""
                  width={56}
                  height={68}
                  className="relative"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(255,190,40,0.55)) drop-shadow(0 0 18px rgba(255,180,0,0.35))',
                    mixBlendMode: 'multiply',
                  }}
                  unoptimized
                />
              </div>
            </motion.div>

            {/* Right Lamp */}
            <motion.div
              animate={{
                y: [3, -2, 3],
                opacity: [0.8, 1, 0.8],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.4,
              }}
              className="absolute -right-8 top-[42%] hidden lg:block"
              aria-hidden="true"
            >
              <div className="relative">
                {/* Soft golden glow effect - layered for depth */}
                <div className="absolute inset-0 -m-4 rounded-full bg-amber-400/25 blur-2xl animate-pulse" />
                <div className="absolute inset-0 -m-2 rounded-full bg-orange-300/20 blur-xl" />
                {/* Deepa Lamp SVG - transparent background with soft golden glow */}
                <Image
                  src="/images/deepa.svg"
                  alt=""
                  width={56}
                  height={68}
                  className="relative"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(255,190,40,0.55)) drop-shadow(0 0 18px rgba(255,180,0,0.35))',
                    mixBlendMode: 'multiply',
                  }}
                  unoptimized
                />
              </div>
            </motion.div>

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
