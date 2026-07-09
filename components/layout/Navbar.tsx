"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronRight, ChevronDown, Heart } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const menuItems = [
  { name: "Home", href: "/" },
  { name: "Shlokas", href: "/shlokas" },
  { name: "Gallery", href: "/gallery" },
];

const sevasDropdown = [
  { name: "Daily Pooja", href: "/pooja" },
  { name: "Special Sevas", href: "/sevas" },
];

const eventsDropdown = [
  { name: "Aaradhane", href: "/aaradhane" },
  { name: "Upcoming Events", href: "/events" },
  { name: "Past Events", href: "/events?filter=past" },
];

const aboutDropdown = [
  { name: "About Us", href: "/about" },
  { name: "Facilities", href: "/facilities" },
  { name: "Guru Parampara", href: "/guruparampara" },
];

const trustDropdown = [
  { name: "Board of Directors", href: "/trust" },
  { name: "Managing Committee", href: "/trust/committee" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sevasOpen, setSevaOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);
  const sevasDropdownRef = useRef<HTMLDivElement>(null);
  const eventsDropdownRef = useRef<HTMLDivElement>(null);
  const aboutDropdownRef = useRef<HTMLDivElement>(null);
  const trustDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);

    onScroll();

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sevasDropdownRef.current && !sevasDropdownRef.current.contains(event.target as Node)) {
        setSevaOpen(false);
      }
      if (eventsDropdownRef.current && !eventsDropdownRef.current.contains(event.target as Node)) {
        setEventsOpen(false);
      }
      if (aboutDropdownRef.current && !aboutDropdownRef.current.contains(event.target as Node)) {
        setAboutOpen(false);
      }
      if (trustDropdownRef.current && !trustDropdownRef.current.contains(event.target as Node)) {
        setTrustOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isSevaActive = pathname === "/pooja" || pathname === "/sevas";
  const isEventsActive = pathname === "/events" || pathname === "/aaradhane";
  const isAboutActive = pathname === "/about" || pathname === "/facilities" || pathname === "/guruparampara";
  const isTrustActive = pathname === "/trust" || pathname === "/trust/committee";

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 shadow-xl backdrop-blur-xl"
          : "bg-white/70 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

        <Link href="/" className="flex items-center gap-4">
          <Image
            src="/images/raghavendra_swamy.png"
            alt="Sri Raghavendra Swamy"
            width={56}
            height={56}
            className="rounded-full object-cover flex-shrink-0 w-14 h-14"
          />

          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-stone-900">
              Sri Raghavendra Swamy Matha
            </h1>

            <p className="text-sm text-amber-700">
              Yelahanka New Town
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">

          {menuItems.map((item) => {

            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`rounded-2xl px-4 py-2 transition-all duration-300 ${
                  active
                    ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg"
                    : "text-stone-700 hover:bg-amber-50"
                }`}
              >
                {item.name}
              </Link>
            );
          })}

          {/* Sevas Dropdown */}
          <div className="relative" ref={sevasDropdownRef}>
            <button
              onClick={() => setSevaOpen(!sevasOpen)}
              className={`flex items-center gap-1 rounded-2xl px-4 py-2 transition-all duration-300 ${
                isSevaActive
                  ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg"
                  : "text-stone-700 hover:bg-amber-50"
              }`}
            >
              Sevas
              <ChevronDown size={16} className={`transition-transform ${sevasOpen ? "rotate-180" : ""}`} />
            </button>

            {sevasOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 rounded-2xl border border-amber-200 bg-white shadow-xl overflow-hidden">
                {sevasDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => {
                        setSevaOpen(false);
                        setOpen(false);
                      }}
                      className={`block px-4 py-3 transition-all ${
                        active
                          ? "bg-amber-100 text-amber-800 font-semibold"
                          : "text-stone-700 hover:bg-amber-50"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Events Dropdown */}
          <div className="relative" ref={eventsDropdownRef}>
            <button
              onClick={() => setEventsOpen(!eventsOpen)}
              className={`flex items-center gap-1 rounded-2xl px-4 py-2 transition-all duration-300 ${
                isEventsActive
                  ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg"
                  : "text-stone-700 hover:bg-amber-50"
              }`}
            >
              Events
              <ChevronDown size={16} className={`transition-transform ${eventsOpen ? "rotate-180" : ""}`} />
            </button>

            {eventsOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 rounded-2xl border border-amber-200 bg-white shadow-xl overflow-hidden">
                {eventsDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => {
                        setEventsOpen(false);
                        setOpen(false);
                      }}
                      className={`block px-4 py-3 transition-all ${
                        active
                          ? "bg-amber-100 text-amber-800 font-semibold"
                          : "text-stone-700 hover:bg-amber-50"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* About Dropdown */}
          <div className="relative" ref={aboutDropdownRef}>
            <button
              onClick={() => setAboutOpen(!aboutOpen)}
              className={`flex items-center gap-1 rounded-2xl px-4 py-2 transition-all duration-300 ${
                isAboutActive
                  ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg"
                  : "text-stone-700 hover:bg-amber-50"
              }`}
            >
              About
              <ChevronDown size={16} className={`transition-transform ${aboutOpen ? "rotate-180" : ""}`} />
            </button>

            {aboutOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 rounded-2xl border border-amber-200 bg-white shadow-xl overflow-hidden">
                {aboutDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => {
                        setAboutOpen(false);
                        setOpen(false);
                      }}
                      className={`block px-4 py-3 transition-all ${
                        active
                          ? "bg-amber-100 text-amber-800 font-semibold"
                          : "text-stone-700 hover:bg-amber-50"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trust Dropdown */}
          <div className="relative" ref={trustDropdownRef}>
            <button
              onClick={() => setTrustOpen(!trustOpen)}
              className={`flex items-center gap-1 rounded-2xl px-4 py-2 transition-all duration-300 ${
                isTrustActive
                  ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg"
                  : "text-stone-700 hover:bg-amber-50"
              }`}
            >
              Trust Committee
              <ChevronDown size={16} className={`transition-transform ${trustOpen ? "rotate-180" : ""}`} />
            </button>

            {trustOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-amber-200 bg-white shadow-xl overflow-hidden">
                {trustDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => {
                        setTrustOpen(false);
                        setOpen(false);
                      }}
                      className={`block px-4 py-3 transition-all ${
                        active
                          ? "bg-amber-100 text-amber-800 font-semibold"
                          : "text-stone-700 hover:bg-amber-50"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </nav>

        <Link
          href="/donation"
          className="hidden items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg transition hover:scale-105 lg:flex"
        >
          <Heart size={18} />
          Donate
        </Link>

        <button
          onClick={() => setOpen(!open)}
          className="rounded-xl p-2 lg:hidden"
        >
          {open ? <X size={30} /> : <Menu size={30} />}
        </button>

      </div>

      {open && (

        <div className="border-t border-amber-100 bg-white lg:hidden">

          <div className="space-y-2 p-5">

            {menuItems.map((item) => {

              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (

                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-2xl px-4 py-4 ${
                    active
                      ? "bg-amber-100 text-amber-800"
                      : "hover:bg-stone-100"
                  }`}
                >
                  {item.name}
                  <ChevronRight size={18} />
                </Link>

              );

            })}

            {/* Sevas dropdown in mobile */}
            <div className="space-y-1">
              <p className="px-4 py-2 text-sm font-semibold text-stone-500">Sevas</p>
              {sevasDropdown.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-2xl px-8 py-4 ${
                      active
                        ? "bg-amber-100 text-amber-800"
                        : "hover:bg-stone-100"
                    }`}
                  >
                    {item.name}
                    <ChevronRight size={18} />
                  </Link>
                );
              })}
            </div>

            {/* Events dropdown in mobile */}
            <div className="space-y-1">
              <p className="px-4 py-2 text-sm font-semibold text-stone-500">Events</p>
              {eventsDropdown.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-2xl px-8 py-4 ${
                      active
                        ? "bg-amber-100 text-amber-800"
                        : "hover:bg-stone-100"
                    }`}
                  >
                    {item.name}
                    <ChevronRight size={18} />
                  </Link>
                );
              })}
            </div>

            {/* About dropdown in mobile */}
            <div className="space-y-1">
              <p className="px-4 py-2 text-sm font-semibold text-stone-500">About</p>
              {aboutDropdown.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-2xl px-8 py-4 ${
                      active
                        ? "bg-amber-100 text-amber-800"
                        : "hover:bg-stone-100"
                    }`}
                  >
                    {item.name}
                    <ChevronRight size={18} />
                  </Link>
                );
              })}
            </div>

            {/* Trust dropdown in mobile */}
            <div className="space-y-1">
              <p className="px-4 py-2 text-sm font-semibold text-stone-500">Trust Committee</p>
              {trustDropdown.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-2xl px-8 py-4 ${
                      active
                        ? "bg-amber-100 text-amber-800"
                        : "hover:bg-stone-100"
                    }`}
                  >
                    {item.name}
                    <ChevronRight size={18} />
                  </Link>
                );
              })}
            </div>

            <Link
              href="/donation"
              onClick={() => setOpen(false)}
              className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white"
            >
              <Heart size={18} />
              Donate Now
            </Link>

          </div>

        </div>

      )}

    </header>
  );
}
