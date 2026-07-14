"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronRight, ChevronDown, Heart, Calendar } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const menuItems = [
  { name: "Home", href: "/" },
  { name: "Guru Parampara", href: "/guruparampara" },
  { name: "Shlokas", href: "/shlokas" },
];

const calendarDropdown = [
  { name: "Ekadasi Calendar", href: "/calendar/ekadashi" },
  { name: "Festival Calendar", href: "/calendar/festivals" },
];

const eventsDropdown = [
  { name: "Aaradhane", href: "/aaradhane" },
  { name: "Upcoming Events", href: "/events" },
  { name: "Past Events", href: "/events?filter=past" },
];

const aboutDropdown = [
  { name: "About Us", href: "/about" },
  { name: "Facilities", href: "/facilities" },
  { name: "Trust Committee", href: "/trust" },
  { name: "Future Plans", href: "/future-plans" },
];

const onlineServicesDropdown = [
  { name: "Daily Seva", href: "/pooja" },
  { name: "Special Seva", href: "/sevas" },
  { name: "Donate", href: "/donation" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [onlineServicesOpen, setOnlineServicesOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const eventsDropdownRef = useRef<HTMLDivElement>(null);
  const aboutDropdownRef = useRef<HTMLDivElement>(null);
  const onlineServicesDropdownRef = useRef<HTMLDivElement>(null);
  const calendarDropdownRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);

    onScroll();

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (open) {
      scrollPositionRef.current = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      document.body.style.touchAction = "";
      window.scrollTo(0, scrollPositionRef.current);
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      document.body.style.touchAction = "";
    };
  }, [open]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (eventsDropdownRef.current && !eventsDropdownRef.current.contains(event.target as Node)) {
        setEventsOpen(false);
      }
      if (aboutDropdownRef.current && !aboutDropdownRef.current.contains(event.target as Node)) {
        setAboutOpen(false);
      }
      if (onlineServicesDropdownRef.current && !onlineServicesDropdownRef.current.contains(event.target as Node)) {
        setOnlineServicesOpen(false);
      }
      if (calendarDropdownRef.current && !calendarDropdownRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isEventsActive = pathname === "/events" || pathname === "/aaradhane";
  const isAboutActive = pathname === "/about" || pathname === "/facilities" || pathname === "/trust" || pathname === "/future-plans";
  const isOnlineServicesActive = pathname === "/pooja" || pathname === "/sevas" || pathname === "/donation";
  const isCalendarActive = pathname.startsWith("/calendar");

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
            src="/images/logos/ynk_matha_logo.png"
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

          {/* Calendar Dropdown */}
          <div className="relative" ref={calendarDropdownRef}>
            <button
              onClick={() => setCalendarOpen(!calendarOpen)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 transition-all duration-300 ${
                isCalendarActive
                  ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg"
                  : "text-stone-700 hover:bg-amber-50"
              }`}
            >
              <Calendar size={18} />
              Calendar
              <ChevronDown size={16} className={`transition-transform ${calendarOpen ? "rotate-180" : ""}`} />
            </button>

            {calendarOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 rounded-2xl border border-amber-200 bg-white shadow-xl overflow-hidden">
                {calendarDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => {
                        setCalendarOpen(false);
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

          <Link
            href="/gallery"
            className={`rounded-2xl px-4 py-2 transition-all duration-300 ${
              pathname === "/gallery"
                ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white shadow-lg"
                : "text-stone-700 hover:bg-amber-50"
            }`}
          >
            Gallery
          </Link>

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

          {/* Online Services Dropdown with Heart */}
          <div className="relative" ref={onlineServicesDropdownRef}>
            <button
              onClick={() => setOnlineServicesOpen(!onlineServicesOpen)}
              className={`flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-5 py-2 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 ${
                isOnlineServicesActive ? "ring-2 ring-white ring-offset-2" : ""
              }`}
            >
              <Heart size={18} />
              Online Services
              <ChevronDown size={16} className={`transition-transform ${onlineServicesOpen ? "rotate-180" : ""}`} />
            </button>

            {onlineServicesOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-amber-200 bg-white shadow-xl overflow-hidden">
                {onlineServicesDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => {
                        setOnlineServicesOpen(false);
                        setOpen(false);
                      }}
                      className={`flex items-center gap-2 px-4 py-3 transition-all ${
                        active
                          ? "bg-amber-100 text-amber-800 font-semibold"
                          : "text-stone-700 hover:bg-amber-50"
                      }`}
                    >
                      {item.name === "Donate" && <Heart size={14} className="text-amber-600" />}
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </nav>

        <button
          onClick={() => setOpen(!open)}
          className="rounded-xl p-2 lg:hidden"
        >
          {open ? <X size={30} /> : <Menu size={30} />}
        </button>

      </div>

      {open && (

        <div className="border-t border-amber-100 bg-white lg:hidden max-h-[calc(100vh-5rem)] overflow-y-auto" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>

          <div className="space-y-2 p-5 pb-safe">

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

            {/* Calendar dropdown in mobile */}
            <div className="space-y-1">
              <p className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-stone-500">
                <Calendar size={14} />
                Calendar
              </p>
              {calendarDropdown.map((item) => {
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

            {/* Gallery link in mobile */}
            <Link
              href="/gallery"
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between rounded-2xl px-4 py-4 ${
                pathname === "/gallery"
                  ? "bg-amber-100 text-amber-800"
                  : "hover:bg-stone-100"
              }`}
            >
              Gallery
              <ChevronRight size={18} />
            </Link>

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

            {/* Online Services dropdown in mobile */}
            <div className="space-y-1">
              <p className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-600">
                <Heart size={14} />
                Online Services
              </p>
              {onlineServicesDropdown.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded-2xl px-8 py-4 ${
                      active
                        ? "bg-amber-100 text-amber-800"
                        : "hover:bg-stone-100"
                    }`}
                  >
                    {item.name === "Donate" && <Heart size={14} className="text-amber-600" />}
                    {item.name}
                    <ChevronRight size={18} className="ml-auto" />
                  </Link>
                );
              })}
            </div>

          </div>

        </div>

      )}

    </header>
  );
}
