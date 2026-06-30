"use client";

import Link from "next/link";
import {
  MapPin,
  Phone,
  Mail,
  Clock3,
  Heart,
  Globe,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

const quickLinks = [
  { name: "Home", href: "/" },
  { name: "Daily Pooja", href: "/pooja" },
  { name: "Special Sevas", href: "/sevas" },
  { name: "Events", href: "/events" },
  { name: "Gallery", href: "/gallery" },
  { name: "Donation", href: "/donation" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-black text-stone-300">

      <div className="absolute inset-0 opacity-5">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "url('/images/Hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-20">

        <div className="grid gap-14 lg:grid-cols-4">

          {/* Temple */}

          <div>

            <div className="flex items-center gap-4">

              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-4xl shadow-xl">
                🛕
              </div>

              <div>

                <h2 className="text-2xl font-bold text-white">
                  Sri Rayara Matha
                </h2>

                <p className="text-amber-400">
                  Yelahanka New Town
                </p>

              </div>

            </div>

            <p className="mt-8 leading-8 text-stone-400">
              Dedicated to Sri Raghavendra Swamy, preserving
              centuries of devotion through daily poojas,
              Annadanam and spiritual service.
            </p>

            <Link
              href="/donation"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-3 font-semibold text-white transition hover:scale-105"
            >
              Donate Now
              <Heart size={18} />
            </Link>

          </div>

          {/* Quick Links */}

          <div>

            <h3 className="mb-8 text-xl font-bold text-white">
              Quick Links
            </h3>

            <div className="space-y-4">

              {quickLinks.map((link) => (

                <Link
                  key={link.name}
                  href={link.href}
                  className="flex items-center gap-2 transition hover:text-amber-400"
                >
                  <ChevronRight size={16} />
                  {link.name}
                </Link>

              ))}

            </div>

          </div>

          {/* Temple Timings */}

          <div>

            <h3 className="mb-8 text-xl font-bold text-white">
              Temple Timings
            </h3>

            <div className="space-y-6">

              <div className="flex gap-4">

                <Clock3 className="mt-1 text-amber-500" />

                <div>

                  <p className="font-semibold text-white">
                    Morning Darshan
                  </p>

                  <p className="text-stone-400">
                    6:00 AM – 1:00 PM
                  </p>

                </div>

              </div>

              <div className="flex gap-4">

                <Clock3 className="mt-1 text-amber-500" />

                <div>

                  <p className="font-semibold text-white">
                    Evening Darshan
                  </p>

                  <p className="text-stone-400">
                    4:30 PM – 8:30 PM
                  </p>

                </div>

              </div>

            </div>

          </div>

          {/* Contact */}

          <div>

            <h3 className="mb-8 text-xl font-bold text-white">
              Contact Us
            </h3>

            <div className="space-y-5">

              <div className="flex gap-4">

                <MapPin className="mt-1 text-amber-500" />

                <span>
                  Sri Rayara Matha<br />
                  Yelahanka New Town<br />
                  Bengaluru
                </span>

              </div>

              <div className="flex gap-4">

                <Phone className="text-amber-500" />

                <span>+91 XXXXX XXXXX</span>

              </div>

              <div className="flex gap-4">

                <Mail className="text-amber-500" />

                <span>info@rayaramatha.org</span>

              </div>

            </div>

            <div className="mt-8 flex gap-3">

              <a
                href="#"
                className="rounded-2xl bg-stone-800 p-4 transition hover:bg-amber-600"
              >
                <Globe size={18} />
              </a>

              <a
                href="#"
                className="rounded-2xl bg-stone-800 p-4 transition hover:bg-amber-600"
              >
                <ExternalLink size={18} />
              </a>

            </div>

          </div>

        </div>

      </div>

      <div className="border-t border-stone-800">

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-stone-400 md:flex-row">

          <p className="flex items-center gap-2">

            © 2026 Sri Rayara Matha

            <Heart
              size={15}
              className="fill-red-500 text-red-500"
            />

            Built with devotion.

          </p>

          <p>
            Powered by Next.js • Firebase • Vercel
          </p>

        </div>

      </div>

    </footer>
  );
}
