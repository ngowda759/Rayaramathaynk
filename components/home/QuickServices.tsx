"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  HeartHandshake,
  Images,
  HandCoins,
  BookOpen,
  MapPin,
  Phone,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const services = [
  {
    title: "Daily Pooja",
    description: "View today's pooja schedule",
    icon: CalendarDays,
    href: "/pooja",
    color: "from-orange-500 to-amber-500",
  },
  {
    title: "Aaradhane",
    description: "Guru Worship Celebrations",
    icon: Sparkles,
    href: "/aaradhane",
    color: "from-red-500 to-orange-500",
  },
  {
    title: "Temple Gallery",
    description: "Photos & celebrations",
    icon: Images,
    href: "/gallery",
    color: "from-sky-500 to-cyan-500",
  },
  {
    title: "Donate",
    description: "Support temple activities",
    icon: HandCoins,
    href: "/donation",
    color: "from-emerald-500 to-green-500",
  },
  {
    title: "Temple History",
    description: "Learn about Rayaramatha",
    icon: BookOpen,
    href: "/about",
    color: "from-violet-500 to-purple-500",
  },
  {
    title: "Upcoming Events",
    description: "Festivals & celebrations",
    icon: CalendarDays,
    href: "/events",
    color: "from-pink-500 to-rose-500",
  },
  {
    title: "Visit Temple",
    description: "Directions & location",
    icon: MapPin,
    href: "/contact",
    color: "from-indigo-500 to-blue-500",
  },
  {
    title: "Contact",
    description: "Temple office details",
    icon: Phone,
    href: "/contact",
    color: "from-teal-500 to-emerald-500",
  },
];

export default function QuickServices() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#fffdf8] to-[#fff6ea] py-24">

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

          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            QUICK SERVICES
          </span>

          <h2 className="mt-6 text-5xl font-bold text-stone-900">
            Everything At One Place
          </h2>

          <p className="mt-6 text-lg leading-8 text-stone-600">
            Access temple services, book sevas, donate, explore festivals
            and stay connected with Sri Rayara Matha.
          </p>

        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">

          {services.map((service, index) => {
            const Icon = service.icon;

            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                viewport={{ once: true }}
              >
                <Link
                  href={service.href}
                  className="group relative block overflow-hidden rounded-[30px] border border-amber-100 bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-3 hover:shadow-2xl"
                >

                  <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-50 transition duration-500 group-hover:scale-150" />

                  <div
                    className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${service.color} text-white shadow-lg`}
                  >
                    <Icon size={30} />
                  </div>

                  <h3 className="relative mt-8 text-2xl font-bold text-stone-900">
                    {service.title}
                  </h3>

                  <p className="relative mt-4 leading-7 text-stone-600">
                    {service.description}
                  </p>

                  <div className="relative mt-8 inline-flex items-center gap-2 font-semibold text-amber-700 transition-all group-hover:gap-3">
                    Explore
                    <ChevronRight size={18} />
                  </div>

                </Link>
              </motion.div>
            );
          })}

        </div>

      </div>

    </section>
  );
}
