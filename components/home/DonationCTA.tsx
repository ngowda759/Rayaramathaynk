"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Heart,
  HandHeart,
  Landmark,
  IndianRupee,
  Star,
  Book,
} from "lucide-react";
import { useFinanceSettings } from "@/hooks/useFinanceSettings";

const iconMap: Record<string, any> = {
  heart: Heart,
  cows: HandHeart,
  building: Landmark,
  star: Star,
  book: Book,
};

export default function DonationCTA() {
  const { enabled, specialSevas } = useFinanceSettings();

  if (!enabled) {
    return null;
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-24">
      <div className="absolute inset-0 opacity-10">
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
        <div className="mx-auto max-w-3xl text-center text-white">
          <span className="rounded-full bg-white/20 px-5 py-2 text-sm font-semibold backdrop-blur">
            SUPPORT THE TEMPLE
          </span>

          <h2 className="mt-6 text-5xl font-bold">
            Every Contribution Matters
          </h2>

          <p className="mt-6 text-lg leading-8 text-amber-100">
            Your donations help us perform daily poojas, Annadanam,
            temple maintenance, Veda Parayana and preserve the rich
            spiritual heritage of Sri Rayara Matha.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {specialSevas.slice(0, 3).map((seva, index) => {
            const Icon = iconMap[seva.icon] || Heart;

            return (
              <motion.div
                key={seva.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                viewport={{ once: true }}
                className="rounded-[30px] border border-white/20 bg-white/10 p-8 backdrop-blur-lg transition hover:-translate-y-2 hover:bg-white/15"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-lg">
                  <Icon size={30} />
                </div>

                <h3 className="mt-6 text-2xl font-bold text-white">
                  {seva.title}
                </h3>

                <div className="mt-5 flex items-center gap-2 text-amber-200">
                  <IndianRupee size={20} />
                  <span className="text-3xl font-bold">
                    {seva.amount}
                  </span>
                </div>

                <p className="mt-5 leading-7 text-amber-100">
                  {seva.description}
                </p>

                <Link
                  href="/donation"
                  className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-semibold text-amber-700 transition hover:scale-105"
                >
                  Donate
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-16 rounded-[32px] bg-white/10 p-10 backdrop-blur-lg">
          <div className="flex flex-col items-center justify-between gap-8 lg:flex-row">
            <div className="text-white">
              <h3 className="text-4xl font-bold">
                Be a Part of Divine Service
              </h3>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-amber-100">
                Every offering, regardless of its size, supports the
                temple&apos;s daily rituals, festivals and charitable
                activities for the benefit of all devotees.
              </p>
            </div>

            <Link
              href="/donation"
              className="rounded-2xl bg-white px-10 py-5 text-lg font-bold text-amber-700 transition hover:scale-105"
            >
              Donate Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
