"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Heart, ChevronRight } from "lucide-react";

const quickLinks = [
  { name: "Home", href: "/" },
  { name: "Aaradhane", href: "/aaradhane" },
  { name: "Facilities", href: "/facilities" },
  { name: "Guru Parampara", href: "/guruparampara" },
  { name: "Gallery", href: "/gallery" },
  { name: "Events", href: "/events" },
  { name: "About", href: "/about" },
  { name: "Shlokas", href: "/shlokas" },
];

const sevasLinks = [
  { name: "Daily Pooja", href: "/pooja" },
  { name: "Special Sevas", href: "/sevas" },
  { name: "Donate", href: "/donation" },
];

const calendarLinks = [
  { name: "Ekadasi Calendar", href: "/calendar/ekadashi" },
  { name: "Festival Calendar", href: "/calendar/festivals" },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-black text-stone-300">
      <div
        className="absolute inset-0 opacity-5 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/Hero.jpg')" }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-10">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5 lg:gap-8">

          {/* Logo & Temple Name */}
          <div className="flex items-start gap-3">
            <Image
              src="/images/logos/ynk_matha_logo.png"
              alt="Sri Raghavendra Swamy Matha"
              width={44}
              height={44}
              className="rounded-full object-cover w-11 h-11 flex-shrink-0"
            />
            <div>
              <h2 className="font-bold text-white leading-tight">
                Sri Raghavendra Swamy Matha
              </h2>
              <p className="text-amber-400 text-sm">
                Yelahanka New Town
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <nav>
            <h3 className="mb-3 text-sm font-bold text-white uppercase tracking-wide">
              Quick Links
            </h3>
            <ul className="space-y-1.5">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-1.5 text-sm transition hover:text-amber-400"
                  >
                    <ChevronRight size={12} className="flex-shrink-0" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sevas */}
          <nav>
            <h3 className="mb-3 text-sm font-bold text-white uppercase tracking-wide">
              Sevas
            </h3>
            <ul className="space-y-1.5">
              {sevasLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-1.5 text-sm transition hover:text-amber-400"
                  >
                    <ChevronRight size={12} className="flex-shrink-0" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Calendar */}
          <nav>
            <h3 className="mb-3 text-sm font-bold text-white uppercase tracking-wide">
              Calendar
            </h3>
            <ul className="space-y-1.5">
              {calendarLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-1.5 text-sm transition hover:text-amber-400"
                  >
                    <ChevronRight size={12} className="flex-shrink-0" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact Us */}
          <address className="not-italic">
            <h3 className="mb-3 text-sm font-bold text-white uppercase tracking-wide">
              Contact Us
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />
                <a
                  href="https://maps.app.goo.gl/JKqBSh7AdNAC6E9d8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-amber-400 transition leading-snug"
                >
                  Sri Rayara Matha, Yelahanka New Town, Bengaluru
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} className="flex-shrink-0 text-amber-500" />
                <a href="tel:+919886364462" className="text-sm hover:text-amber-400 transition">
                  +91 9886364462
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="flex-shrink-0 text-amber-500" />
                <a href="mailto:ngowda759@gmail.com" className="text-sm hover:text-amber-400 transition truncate">
                  ngowda759@gmail.com
                </a>
              </div>
            </div>
          </address>

        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-stone-800">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-stone-400 md:flex-row">
            <p className="flex items-center gap-1.5">
              © 2026 Sri Raghavendra Swamy Matha
              <Heart size={12} className="fill-red-500 text-red-500" />
              Built with devotion.
            </p>
            <p>Sri Raghavendra Swamy Matha • Yelahanka New Town</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
