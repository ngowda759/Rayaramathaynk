"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone, Mail, Heart, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

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
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-orange-500" />
      
      {/* Pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] sacred-pattern"
        style={{ backgroundImage: "url('/images/Hero.jpg')" }}
      />
      
      {/* Decorative mandala */}
      <div className="absolute right-0 top-0 w-64 h-64 opacity-5">
        <svg viewBox="0 0 100 100" className="w-full h-full text-amber-500">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-10">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5 lg:gap-8">

          {/* Logo & Temple Name */}
          <div className="flex items-start gap-3">
            <div className="relative">
              <Image
                src="/images/logos/ynk_matha_logo.png"
                alt="Sri Raghavendra Swamy Matha"
                width={44}
                height={44}
                className="rounded-full object-cover w-11 h-11 flex-shrink-0 ring-2 ring-amber-500/30"
              />
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-pulse" />
            </div>
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
            <h3 className="mb-4 text-sm font-bold text-white uppercase tracking-wider">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-2 text-sm transition-colors hover:text-amber-400"
                  >
                    <span className="h-1 w-1 rounded-full bg-amber-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sevas */}
          <nav>
            <h3 className="mb-4 text-sm font-bold text-white uppercase tracking-wider">
              Sevas
            </h3>
            <ul className="space-y-2">
              {sevasLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-2 text-sm transition-colors hover:text-amber-400"
                  >
                    <span className="h-1 w-1 rounded-full bg-amber-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Calendar */}
          <nav>
            <h3 className="mb-4 text-sm font-bold text-white uppercase tracking-wider">
              Calendar
            </h3>
            <ul className="space-y-2">
              {calendarLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="group flex items-center gap-2 text-sm transition-colors hover:text-amber-400"
                  >
                    <span className="h-1 w-1 rounded-full bg-amber-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact Us */}
          <address className="not-italic">
            <h3 className="mb-4 text-sm font-bold text-white uppercase tracking-wider">
              Contact Us
            </h3>
            <div className="space-y-3">
              <motion.a
                href="https://maps.app.goo.gl/JKqBSh7AdNAC6E9d8"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2.5 text-sm transition-colors hover:text-amber-400"
                whileHover={{ x: 4 }}
              >
                <MapPin size={16} className="mt-0.5 flex-shrink-0 text-amber-500 group-hover:text-amber-400" />
                <span className="leading-snug">Sri Rayara Matha, Yelahanka New Town, Bengaluru</span>
              </motion.a>
              <motion.a
                href="tel:+919886364462"
                className="group flex items-center gap-2.5 text-sm transition-colors hover:text-amber-400"
                whileHover={{ x: 4 }}
              >
                <Phone size={16} className="flex-shrink-0 text-amber-500 group-hover:text-amber-400" />
                +91 9886364462
              </motion.a>
              <motion.a
                href="mailto:ngowda759@gmail.com"
                className="group flex items-center gap-2.5 text-sm transition-colors hover:text-amber-400"
                whileHover={{ x: 4 }}
              >
                <Mail size={16} className="flex-shrink-0 text-amber-500 group-hover:text-amber-400" />
                <span className="truncate">ngowda759@gmail.com</span>
              </motion.a>
            </div>
          </address>

        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-stone-800/50 relative">
        {/* Om Symbol */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -mt-6 text-amber-500/10 text-6xl font-serif select-none">
          ॐ
        </div>
        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-stone-400 md:flex-row">
            <motion.p 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
            >
              <span>© 2026 Sri Raghavendra Swamy Matha</span>
              <Heart size={14} className="fill-red-500 text-red-500 animate-pulse" />
              <span>Built with devotion</span>
            </motion.p>
            <p className="text-stone-500">ॐ Sri Raghavendraya Namaha ॐ</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
