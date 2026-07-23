"use client";

import React from "react";
import {
  Bell,
  CalendarDays,
  Clock3,
  ArrowRight,
  Navigation,
  Phone,
  Share2,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useLocation, useShare } from "@/lib/device";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";

const cards = [
  {
    title: "Temple Status",
    value: "🟢 OPEN NOW",
    description: "Morning Darshan • 6:00 AM - 1:00 PM",
    icon: Clock3,
    color: "from-green-500 to-emerald-600",
  },
  {
    title: "Today's Seva",
    value: "Maha Pooja",
    description: "Starts at 10:30 AM",
    icon: Bell,
    color: "from-amber-500 to-orange-500",
  },
  {
    title: "Upcoming Festival",
    value: "Guru Aaradhane",
    description: "12 Days Remaining",
    icon: CalendarDays,
    color: "from-rose-500 to-pink-500",
  },
];

const TEMPLE_ADDRESS = "428/20, 8th A Cross Rd, Yelahanka Satellite Town, Yelahanka, Bengaluru, Karnataka 560064";
const TEMPLE_PHONE = "+91 80 2332 3456";

export default function TempleInfo() {
  const reducedMotion = useReducedMotion();
  const location = useLocation();
  const share = useShare();
  const [copied, setCopied] = React.useState(false);
  const [isSharing, setIsSharing] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);

  // Handle navigation to temple
  const handleNavigate = async () => {
    setIsNavigating(true);
    try {
      location.openNavigation();
    } finally {
      setIsNavigating(false);
    }
  };

  // Share temple info
  const handleShareTemple = async () => {
    setIsSharing(true);
    const success = await share.share({
      title: "Sri Raghavendra Swamy Matha",
      text: "Visit Sri Raghavendra Swamy Matha in Yelahanka, Bengaluru. A sacred place of devotion and spiritual learning.",
      url: typeof window !== "undefined" ? window.location.origin : "",
    });
    setIsSharing(false);
    if (success) {
      toast.success("Temple information has been shared");
    }
  };

  // Copy address
  const handleCopyAddress = async () => {
    const success = await share.copyToClipboard(TEMPLE_ADDRESS);
    if (success) {
      setCopied(true);
      toast.success("Address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Call temple
  const handleCallTemple = () => {
    window.location.href = `tel:${TEMPLE_PHONE}`;
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#fffaf4] via-white to-[#fff8ef] py-24">

      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "url('/images/Hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">

        <div className="mx-auto max-w-3xl text-center">

          <motion.span
            initial={reducedMotion ? {} : { opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700"
          >
            TEMPLE INFORMATION
          </motion.span>

          <motion.h2
            initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reducedMotion ? 0 : 0.1 }}
            className="mt-6 text-5xl font-bold text-stone-900"
          >
            Experience Divine Peace
          </motion.h2>

          <motion.p
            initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reducedMotion ? 0 : 0.2 }}
            className="mt-6 text-lg leading-8 text-stone-600"
          >
            Sri Rayara Matha is a sacred place of devotion,
            daily poojas, spiritual learning and community
            service dedicated to Sri Raghavendra Swamy.
          </motion.p>

          {/* Temple Action Buttons */}
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: reducedMotion ? 0 : 0.3 }}
            className="mt-6 flex flex-wrap justify-center gap-3"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleNavigate}
              disabled={isNavigating}
              className="gap-2"
            >
              {isNavigating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              {location.formattedDistance || "Navigate"}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCallTemple}
              className="gap-2"
            >
              <Phone className="h-4 w-4" />
              Call Temple
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAddress}
              className="gap-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy Address"}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareTemple}
              disabled={isSharing}
              className="gap-2"
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              Share Temple
            </Button>
          </motion.div>

        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 xl:grid-cols-3">

          {cards.map((card, index) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.title}
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reducedMotion ? 0.01 : 0.5,
                  delay: reducedMotion ? 0 : index * 0.15,
                }}
                viewport={{ once: true }}
                whileHover={reducedMotion ? {} : { y: -8, transition: { duration: 0.2 } }}
                className="group rounded-3xl border border-amber-100 bg-white/80 p-8 shadow-lg backdrop-blur transition-all duration-300 hover:shadow-2xl"
              >

                <div
                  className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${card.color} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon size={30} />
                </div>

                <h3 className="mt-7 text-xl font-bold text-stone-900">
                  {card.title}
                </h3>

                <p className="mt-3 text-2xl font-bold text-amber-700">
                  {card.value}
                </p>

                <p className="mt-4 leading-7 text-stone-600">
                  {card.description}
                </p>

              </motion.div>
            );
          })}

        </div>

        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: reducedMotion ? 0.01 : 0.5 }}
          className="mt-20 rounded-[32px] bg-gradient-to-r from-amber-600 to-orange-500 p-10 text-white shadow-2xl"
        >

          <div className="grid items-center gap-8 lg:grid-cols-2">

            <div>

              <h3 className="text-4xl font-bold">
                Visit Sri Rayara Matha
              </h3>

              <p className="mt-5 text-lg leading-8 text-amber-100">
                Join us for daily poojas, special sevas,
                Guru Aaradhane celebrations and Annadanam.
                Experience divine blessings in a peaceful
                spiritual atmosphere.
              </p>

            </div>

            <div className="flex justify-start gap-4 lg:justify-end">

              <Link
                href="/sevas"
                className="rounded-2xl bg-white px-8 py-4 font-semibold text-amber-700 transition-all hover:scale-105 hover:shadow-lg"
              >
                Book Seva
              </Link>

              <Link
                href="/about"
                className="flex items-center gap-2 rounded-2xl border border-white/40 px-8 py-4 font-semibold transition-all hover:bg-white/10"
              >
                Learn More
                <ArrowRight size={18} />
              </Link>

            </div>

          </div>

        </motion.div>

      </div>

    </section>
  );
}
