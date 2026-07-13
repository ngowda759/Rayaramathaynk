"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Calendar, 
  Sparkles, 
  Clock, 
  Users, 
  Flower2, 
  Star, 
  ArrowRight,
  Gem,
  Flame
} from "lucide-react";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/home/Hero";
import { Aaradhane } from "@/types/aaradhane";
import { aaradhaneService } from "@/services/aaradhane.service";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getNextDate(dates: string[]): string | null {
  if (!dates || dates.length === 0) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const upcomingDates = dates
    .map(d => new Date(d))
    .filter(d => d >= now)
    .sort((a, b) => a.getTime() - b.getTime());
  
  return upcomingDates[0]?.toISOString() || null;
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    // Use setTimeout to avoid synchronous state update during effect
    setTimeout(() => setTimeLeft(calculateTimeLeft()), 0);
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const units = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hours" },
    { value: timeLeft.minutes, label: "Mins" },
    { value: timeLeft.seconds, label: "Secs" }
  ];

  return (
    <div className="flex justify-center gap-3 sm:gap-4">
      {units.map((unit, idx) => (
        <motion.div
          key={unit.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="flex flex-col items-center"
        >
          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm sm:h-16 sm:w-16 md:h-20 md:w-20">
            <span className="text-xl font-bold text-white sm:text-2xl md:text-3xl">
              {String(unit.value).padStart(2, "0")}
            </span>
          </div>
          <span className="mt-1 text-xs font-medium text-amber-100 sm:text-sm">
            {unit.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

export default function AaradhanePage() {
  const [aaradhanes, setAaradhanes] = useState<Aaradhane[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAaradhanes() {
      try {
        const data = await aaradhaneService.getAaradhanes();
        setAaradhanes(data);
      } catch (err) {
        console.error("Failed to load aaradhanes:", err);
        setError("Failed to load aaradhane details. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchAaradhanes();
  }, []);

  const upcomingAaradhanes = aaradhanes.filter((a) => a.isUpcoming);
  const pastAaradhanes = aaradhanes.filter((a) => !a.isUpcoming).reverse();
  const featuredAaradhane = upcomingAaradhanes[0];
  const nextDate = featuredAaradhane ? getNextDate(featuredAaradhane.dates) : null;

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-[#fffdf8]">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-orange-500 to-red-500 px-6 py-16 sm:px-8 lg:px-12">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-16 -left-16 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
          </div>
          
          <div className="relative z-10 mx-auto max-w-7xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                <Flame className="h-4 w-4" />
                Sacred Devotional Services
              </div>
              
              <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                Aaradhane Services
              </h1>
              
              <p className="mx-auto mt-3 max-w-xl text-base text-amber-100 sm:text-lg">
                Experience divine worship and spiritual enlightenment through our sacred aaradhane ceremonies.
              </p>
              
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm text-white backdrop-blur-sm">
                  <Star className="h-4 w-4 text-amber-200" />
                  <span className="font-medium">{aaradhanes.length} Events</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm text-white backdrop-blur-sm">
                  <Sparkles className="h-4 w-4 text-amber-200" />
                  <span className="font-medium">{upcomingAaradhanes.length} Upcoming</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm text-white backdrop-blur-sm">
                  <Calendar className="h-4 w-4 text-amber-200" />
                  <span className="font-medium">{pastAaradhanes.length} Past</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Featured Upcoming Event with Countdown */}
        {loading && (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="mx-6 mt-10 max-w-5xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center sm:mx-8 lg:mx-12">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && featuredAaradhane && (
          <section className="mx-6 -mt-10 sm:mx-8 lg:mx-12">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="overflow-hidden rounded-[32px] border border-amber-200 bg-white shadow-2xl"
            >
              <div className="flex flex-col lg:flex-row">
                {/* Image Section */}
                <div className="relative h-64 w-full lg:h-auto lg:w-1/2">
                  {featuredAaradhane.imageUrl ? (
                    <Image
                      src={`/images/aaradhane/${featuredAaradhane.imageUrl}`}
                      alt={featuredAaradhane.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100">
                      <Flower2 className="h-24 w-24 text-amber-400" />
                    </div>
                  )}
                  
                  {/* Overlay Badge */}
                  <div className="absolute left-4 top-4 rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-lg">
                    <Sparkles className="mr-2 inline h-4 w-4" />
                    Featured Event
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex flex-col justify-center p-6 lg:p-10 lg:w-1/2">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-600">
                    <Users className="h-4 w-4" />
                    Conducted by {featuredAaradhane.guruName}
                  </div>
                  
                  <h2 className="mt-3 text-3xl font-bold text-stone-900 sm:text-4xl">
                    {featuredAaradhane.title}
                  </h2>
                  
                  {nextDate && (
                    <div className="mt-6 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 p-6 text-white">
                      <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-amber-100">
                        <Clock className="h-4 w-4" />
                        Event Begins In
                      </div>
                      <CountdownTimer targetDate={nextDate} />
                      <div className="mt-4 text-center text-sm text-amber-100">
                        {formatFullDate(nextDate)}
                      </div>
                    </div>
                  )}

                  <p className="mt-6 text-lg leading-relaxed text-stone-600">
                    {featuredAaradhane.description}
                  </p>

                  {featuredAaradhane.significance && (
                    <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <Star className="h-4 w-4 text-amber-600" />
                        Significance
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-stone-600">
                        {featuredAaradhane.significance}
                      </p>
                    </div>
                  )}

                  {featuredAaradhane.rituals && featuredAaradhane.rituals.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
                        <Gem className="h-4 w-4 text-amber-600" />
                        Sacred Rituals
                      </div>
                      <ul className="mt-3 space-y-2">
                        {featuredAaradhane.rituals.map((ritual, index) => (
                          <li key={index} className="flex items-center gap-3 text-sm text-stone-600">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                              {index + 1}
                            </span>
                            {ritual}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </section>
        )}

        {/* Other Upcoming Events */}
        {!loading && !error && upcomingAaradhanes.length > 1 && (
          <section className="mx-6 mt-16 sm:mx-8 lg:mx-12">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-stone-900 sm:text-3xl">
                  More Upcoming Events
                </h2>
                <p className="mt-2 text-stone-600">
                  Mark your calendar for these upcoming aaradhane ceremonies
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingAaradhanes.slice(1).map((aaradhane, index) => (
                <motion.div
                  key={aaradhane.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group overflow-hidden rounded-[24px] border border-amber-100 bg-white shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
                >
                  {aaradhane.imageUrl && (
                    <div className="relative h-48 overflow-hidden">
                      <Image
                        src={`/images/aaradhane/${aaradhane.imageUrl}`}
                        alt={aaradhane.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    </div>
                  )}
                  
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                      <Calendar className="h-4 w-4" />
                      {aaradhane.guruName}
                    </div>
                    
                    <h3 className="mt-2 text-xl font-bold text-stone-900">
                      {aaradhane.title}
                    </h3>
                    
                    <div className="mt-3 space-y-1">
                      {aaradhane.dates.slice(0, 2).map((date, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-stone-500">
                          <Clock className="h-3 w-3" />
                          {formatDate(date)}
                        </div>
                      ))}
                      {aaradhane.dates.length > 2 && (
                        <p className="text-xs text-stone-400">
                          +{aaradhane.dates.length - 2} more dates
                        </p>
                      )}
                    </div>

                    <p className="mt-4 line-clamp-2 text-sm text-stone-600">
                      {aaradhane.description}
                    </p>

                    <div className="mt-4 flex items-center text-sm font-semibold text-amber-600">
                      View Details
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Past Events Timeline */}
        {!loading && !error && pastAaradhanes.length > 0 && (
          <section className="mx-6 mt-20 sm:mx-8 lg:mx-12">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold text-stone-900 sm:text-4xl">
                Past Ceremonies
              </h2>
              <p className="mt-4 text-lg text-stone-600">
                Reflect on the divine experiences from previous aaradhane events
              </p>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 h-full w-0.5 bg-gradient-to-b from-amber-400 via-orange-400 to-stone-300 sm:left-1/2 sm:-translate-x-px" />

              <div className="space-y-8">
                {pastAaradhanes.map((aaradhane, index) => (
                  <motion.div
                    key={aaradhane.id}
                    initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.15 }}
                    className={`relative flex flex-col gap-4 sm:flex-row ${
                      index % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"
                    }`}
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 shadow-lg sm:left-1/2 sm:-translate-x-1/2">
                      <Flower2 className="h-4 w-4 text-white" />
                    </div>

                    {/* Content */}
                    <div className={`ml-12 sm:w-1/2 ${index % 2 === 0 ? "sm:pr-12" : "sm:pl-12"}`}>
                      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-md transition hover:shadow-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-stone-900">
                              {aaradhane.title}
                            </h3>
                            <p className="mt-1 text-sm text-stone-500">
                              by {aaradhane.guruName}
                            </p>
                          </div>
                          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                            Past
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {aaradhane.dates.slice(0, 3).map((date, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                            >
                              {formatDate(date)}
                            </span>
                          ))}
                          {aaradhane.dates.length > 3 && (
                            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                              +{aaradhane.dates.length - 3} more
                            </span>
                          )}
                        </div>

                        <p className="mt-4 line-clamp-3 text-sm text-stone-600">
                          {aaradhane.description}
                        </p>
                      </div>
                    </div>

                    {/* Spacer for alternating layout */}
                    <div className="hidden sm:block sm:w-1/2" />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Empty State */}
        {!loading && !error && aaradhanes.length === 0 && (
          <div className="mx-6 mt-20 rounded-[32px] border border-stone-200 bg-white py-20 text-center sm:mx-8 lg:mx-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
              <Sparkles className="h-10 w-10 text-amber-600" />
            </div>
            <h3 className="mt-6 text-2xl font-bold text-stone-900">
              No Aaradhane Events Yet
            </h3>
            <p className="mx-auto mt-4 max-w-md text-stone-600">
              Special aaradhane ceremonies will be announced soon. 
              Stay connected with us for updates on upcoming devotional events.
            </p>
            <Link
              href="/events"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-amber-600 px-6 py-3 font-semibold text-white transition hover:bg-amber-700"
            >
              View All Events
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* About Aaradhane Section */}
        {!loading && !error && aaradhanes.length > 0 && (
          <section className="mx-6 mt-20 sm:mx-8 lg:mx-12">
            <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 p-8 sm:p-12 lg:p-16">
              <div className="mx-auto max-w-4xl text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">
                  <Flower2 className="h-4 w-4" />
                  Sacred Tradition
                </div>
                
                <h2 className="mt-6 text-3xl font-bold text-stone-900 sm:text-4xl">
                  About Aaradhane
                </h2>
                
                <p className="mt-6 text-lg leading-relaxed text-stone-700">
                  <span className="font-semibold text-amber-800">Aaradhane</span> is a sacred and profound 
                  tradition of devotional worship conducted daily at our temple. This divine practice 
                  involves dedicated chanting, elaborate rituals, and heartfelt prayers dedicated to 
                  Lord Raghavendra Swamy.
                </p>
                
                <p className="mt-4 text-lg leading-relaxed text-stone-700">
                  Special aaradhane sessions are conducted during festivals and auspicious holy days, 
                  attracting devotees from across the region who seek spiritual enlightenment and 
                  the blessings of the deity.
                </p>

                <div className="mt-10 grid gap-6 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-6 shadow-md">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                      <Star className="h-7 w-7 text-amber-600" />
                    </div>
                    <h3 className="mt-4 font-bold text-stone-900">Daily Worship</h3>
                    <p className="mt-2 text-sm text-stone-600">
                      Regular aaradhane conducted every day with devotion
                    </p>
                  </div>
                  
                  <div className="rounded-2xl bg-white/80 p-6 shadow-md">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
                      <Sparkles className="h-7 w-7 text-orange-600" />
                    </div>
                    <h3 className="mt-4 font-bold text-stone-900">Special Events</h3>
                    <p className="mt-2 text-sm text-stone-600">
                      Grand ceremonies during festivals and holy occasions
                    </p>
                  </div>
                  
                  <div className="rounded-2xl bg-white/80 p-6 shadow-md">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                      <Users className="h-7 w-7 text-red-600" />
                    </div>
                    <h3 className="mt-4 font-bold text-stone-900">Community</h3>
                    <p className="mt-2 text-sm text-stone-600">
                      Join fellow devotees in collective worship
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="mx-6 my-20 sm:mx-8 lg:mx-12">
          <div className="overflow-hidden rounded-[32px] bg-gradient-to-r from-amber-600 to-orange-500 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Participate in Divine Worship
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-amber-100">
              Join us for the sacred aaradhane ceremonies and experience 
              spiritual peace and divine blessings.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/sevas"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-amber-700 transition hover:bg-amber-50"
              >
                Book a Seva
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/donation"
                className="inline-flex items-center gap-2 rounded-full bg-white/20 px-6 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
              >
                Support Temple
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
