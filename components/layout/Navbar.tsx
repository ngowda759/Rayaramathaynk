"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronRight, ChevronDown, Heart, Calendar, BookOpen, User, ExternalLink } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { settingsService } from "@/services/settings.service";

interface DropdownItem {
  name: string;
  href: string;
  external?: boolean;
}

const menuItems = [
  { name: "Home", href: "/" },
  { name: "Shlokas", href: "/shlokas" },
];

const guruParamparaDropdown: DropdownItem[] = [
  { name: "Guru Parampara", href: "/guruparampara" },
  { name: "Knowledge Centre", href: "/knowledge" },
  { name: "Temple Explorer", href: "/temple-explorer" },
];

const calendarDropdown: DropdownItem[] = [
  { name: "Ekadasi Calendar", href: "/calendar/ekadashi" },
  { name: "Festival Calendar", href: "/calendar/festivals" },
];

const aboutDropdown: DropdownItem[] = [
  { name: "About Us", href: "/about" },
  { name: "Facilities", href: "/facilities" },
  { name: "Trust Committee", href: "/trust" },
  { name: "Future Plans", href: "/future-plans" },
];

const onlineServicesDropdown: DropdownItem[] = [
  { name: "Daily Seva", href: "/pooja" },
  { name: "Special Seva", href: "/sevas" },
  { name: "Donate", href: "/donation" },
  { name: "Register", href: "/register" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [guruParamparaOpen, setGuruParamparaOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [onlineServicesOpen, setOnlineServicesOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("https://www.youtube.com/@Guru_Raghavendra_Rayaru");
  const guruParamparaDropdownRef = useRef<HTMLDivElement>(null);
  const eventsDropdownRef = useRef<HTMLDivElement>(null);
  const aboutDropdownRef = useRef<HTMLDivElement>(null);
  const onlineServicesDropdownRef = useRef<HTMLDivElement>(null);
  const calendarDropdownRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef(0);

  // Mobile accordion state
  const [mobileGuruOpen, setMobileGuruOpen] = useState(false);
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);
  const [mobileEventsOpen, setMobileEventsOpen] = useState(false);
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);

  // Fetch YouTube URL from settings
  useEffect(() => {
    async function fetchSocialLinks() {
      try {
        const socialLinks = await settingsService.getSocialLinks();
        if (socialLinks.youtube) {
          setYoutubeUrl(socialLinks.youtube);
        }
      } catch (error) {
        console.error("Error fetching social links:", error);
      }
    }
    fetchSocialLinks();
  }, []);

  const eventsDropdown: DropdownItem[] = [
    { name: "Live Darshan", href: youtubeUrl, external: true },
    { name: "Aaradhane", href: "/aaradhane" },
    { name: "Upcoming Events", href: "/events" },
    { name: "Past Events", href: "/events?filter=past" },
  ];

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
      if (guruParamparaDropdownRef.current && !guruParamparaDropdownRef.current.contains(event.target as Node)) {
        setGuruParamparaOpen(false);
      }
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

  const isGuruParamparaActive = pathname === "/guruparampara" || pathname === "/knowledge" || pathname === "/temple-explorer";
  const isEventsActive = pathname === "/events" || pathname === "/aaradhane";
  const isAboutActive = pathname === "/about" || pathname === "/facilities" || pathname === "/trust" || pathname === "/future-plans";
  const isOnlineServicesActive = pathname === "/pooja" || pathname === "/sevas" || pathname === "/donation" || pathname === "/register";
  const isCalendarActive = pathname.startsWith("/calendar");

  // Close mobile menu on route change
  const handleMobileNavClick = useCallback(() => {
    setOpen(false);
  }, []);

  /* ─── Active pill classes ─── */
  const activePillClass =
    "bg-[var(--temple-maroon)] text-[var(--temple-cream)] shadow-[0_2px_8px_var(--temple-maroon)/25] border border-[var(--temple-gold-dark)]/30";
  const inactivePillClass =
    "text-[var(--temple-maroon)] hover:bg-[var(--temple-cream)] hover:scale-[1.01] hover:-translate-y-px";

  /* ─── Dropdown item classes ─── */
  const dropdownActiveClass = "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold border-l-2 border-[var(--temple-gold)]";
  const dropdownInactiveClass = "text-stone-700 hover:bg-[var(--temple-cream)] hover:text-[var(--temple-maroon)]";

  return (
    <header className="sticky top-0 z-50 flex w-full justify-center px-3 sm:px-4 lg:px-6">
      {/* Floating glass container */}
      <div
        className={[
          "mt-2 w-full max-w-[1400px] transition-all duration-500 ease-out",
          "rounded-3xl",
          "border border-[var(--temple-gold-light)]/40",
          scrolled
            ? "bg-[var(--temple-warm-white)]/85 shadow-[0_4px_24px_0_rgba(0,0,0,0.08)] backdrop-blur-xl py-0"
            : "bg-[var(--temple-warm-white)]/60 shadow-[0_2px_12px_0_rgba(0,0,0,0.04)] backdrop-blur-md py-1",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-all duration-500 ease-out",
            scrolled ? "h-16" : "h-[4.5rem]",
          ].join(" ")}
        >

          {/* ─── Brand ─── */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <Image
              src="/images/logos/ynk_matha_logo.png"
              alt="Sri Raghavendra Swamy"
              width={48}
              height={48}
              className={[
                "rounded-full object-cover flex-shrink-0 transition-all duration-500 ease-out",
                "border-2 border-[var(--temple-gold)]/30",
                "shadow-[0_0_12px_var(--temple-gold)/15]",
                scrolled ? "w-10 h-10" : "w-12 h-12",
              ].join(" ")}
            />

            <div className="flex-col hidden sm:flex">
              <h1 className="text-base lg:text-lg font-bold text-[var(--temple-maroon)] leading-tight">
                Sri Raghavendra Swamy Matha
              </h1>

              <p className="text-xs text-[var(--temple-gold-dark)] tracking-wide">
                Yelahanka New Town
              </p>
            </div>
          </Link>

          {/* ─── Desktop Navigation ─── */}
          <nav className="hidden items-center gap-0.5 xl:gap-1 lg:flex" role="navigation" aria-label="Main navigation">

            {menuItems.map((item) => {

              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={[
                    "rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-300 ease-out",
                    active ? activePillClass : inactivePillClass,
                  ].join(" ")}
                >
                  {item.name}
                </Link>
              );
            })}

            {/* Guru Parampara Dropdown */}
            <div className="relative" ref={guruParamparaDropdownRef}>
              <button
                onClick={() => setGuruParamparaOpen(!guruParamparaOpen)}
                aria-expanded={guruParamparaOpen}
                aria-haspopup="true"
                className={[
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-300 ease-out",
                  isGuruParamparaActive ? activePillClass : inactivePillClass,
                ].join(" ")}
              >
                <BookOpen size={16} />
                Guru Parampara
                <ChevronDown size={14} className={`transition-transform duration-200 ${guruParamparaOpen ? "rotate-180" : ""}`} />
              </button>

              <div
                className={[
                  "absolute left-0 top-full mt-2 w-56 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/90 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  guruParamparaOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
                ].join(" ")}
              >
                {guruParamparaDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => {
                        setGuruParamparaOpen(false);
                        setOpen(false);
                      }}
                      className={[
                        "block px-4 py-3 text-sm transition-all duration-200",
                        active ? dropdownActiveClass : dropdownInactiveClass,
                      ].join(" ")}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Calendar Dropdown */}
            <div className="relative" ref={calendarDropdownRef}>
              <button
                onClick={() => setCalendarOpen(!calendarOpen)}
                aria-expanded={calendarOpen}
                aria-haspopup="true"
                className={[
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-300 ease-out",
                  isCalendarActive ? activePillClass : inactivePillClass,
                ].join(" ")}
              >
                <Calendar size={16} />
                Calendar
                <ChevronDown size={14} className={`transition-transform duration-200 ${calendarOpen ? "rotate-180" : ""}`} />
              </button>

              <div
                className={[
                  "absolute left-0 top-full mt-2 w-52 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/90 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  calendarOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
                ].join(" ")}
              >
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
                      className={[
                        "block px-4 py-3 text-sm transition-all duration-200",
                        active ? dropdownActiveClass : dropdownInactiveClass,
                      ].join(" ")}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            <Link
              href="/gallery"
              className={[
                "rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-300 ease-out",
                pathname === "/gallery" ? activePillClass : inactivePillClass,
              ].join(" ")}
            >
              Gallery
            </Link>

            {/* Events Dropdown */}
            <div className="relative" ref={eventsDropdownRef}>
              <button
                onClick={() => setEventsOpen(!eventsOpen)}
                aria-expanded={eventsOpen}
                aria-haspopup="true"
                className={[
                  "flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-300 ease-out",
                  isEventsActive ? activePillClass : inactivePillClass,
                ].join(" ")}
              >
                Events
                <ChevronDown size={14} className={`transition-transform duration-200 ${eventsOpen ? "rotate-180" : ""}`} />
              </button>

              <div
                className={[
                  "absolute left-0 top-full mt-2 w-52 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/90 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  eventsOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
                ].join(" ")}
              >
                {eventsDropdown.map((item) => {
                  const active = pathname === item.href;
                  const isLive = item.name === "Live Darshan";
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={() => {
                        setEventsOpen(false);
                        setOpen(false);
                      }}
                      className={[
                        "flex items-center gap-2 px-4 py-3 text-sm transition-all duration-200",
                        isLive
                          ? "bg-red-50/80 text-red-700 font-semibold hover:bg-red-100/80"
                          : active
                          ? dropdownActiveClass
                          : dropdownInactiveClass,
                      ].join(" ")}
                    >
                      {isLive && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                        </span>
                      )}
                      {item.name}
                      {isLive && <ExternalLink size={12} className="ml-auto text-red-400" />}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* About Dropdown */}
            <div className="relative" ref={aboutDropdownRef}>
              <button
                onClick={() => setAboutOpen(!aboutOpen)}
                aria-expanded={aboutOpen}
                aria-haspopup="true"
                className={[
                  "flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-300 ease-out",
                  isAboutActive ? activePillClass : inactivePillClass,
                ].join(" ")}
              >
                About
                <ChevronDown size={14} className={`transition-transform duration-200 ${aboutOpen ? "rotate-180" : ""}`} />
              </button>

              <div
                className={[
                  "absolute left-0 top-full mt-2 w-52 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/90 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  aboutOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
                ].join(" ")}
              >
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
                      className={[
                        "block px-4 py-3 text-sm transition-all duration-200",
                        active ? dropdownActiveClass : dropdownInactiveClass,
                      ].join(" ")}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Online Services Dropdown with Heart — Gold CTA */}
            <div className="relative" ref={onlineServicesDropdownRef}>
              <button
                onClick={() => setOnlineServicesOpen(!onlineServicesOpen)}
                aria-expanded={onlineServicesOpen}
                aria-haspopup="true"
                className={[
                  "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-300 ease-out",
                  "bg-[var(--temple-gold)] text-[var(--temple-maroon)]",
                  "shadow-[0_2px_12px_var(--temple-gold)/30]",
                  "hover:shadow-[0_4px_16px_var(--temple-gold)/40] hover:brightness-105",
                  isOnlineServicesActive ? "ring-2 ring-[var(--temple-maroon)]/20 ring-offset-1" : "",
                ].join(" ")}
              >
                <Heart size={16} />
                Online Services
                <ChevronDown size={14} className={`transition-transform duration-200 ${onlineServicesOpen ? "rotate-180" : ""}`} />
              </button>

              <div
                className={[
                  "absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/90 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  onlineServicesOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
                ].join(" ")}
              >
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
                      className={[
                        "flex items-center gap-2 px-4 py-3 text-sm transition-all duration-200",
                        active ? dropdownActiveClass : dropdownInactiveClass,
                      ].join(" ")}
                    >
                      {item.name === "Donate" && <Heart size={14} className="text-[var(--temple-gold-dark)]" />}
                      {item.name === "Register" && <User size={14} className="text-[var(--temple-gold-dark)]" />}
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

          </nav>

          {/* ─── Mobile Controls ─── */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* Mobile Donate CTA */}
            <Link
              href="/donation"
              className={[
                "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-300",
                "bg-[var(--temple-gold)] text-[var(--temple-maroon)]",
                "shadow-[0_2px_8px_var(--temple-gold)/25]",
              ].join(" ")}
            >
              <Heart size={14} />
              Donate
            </Link>

            <button
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className={[
                "rounded-xl p-2 transition-all duration-200",
                "text-[var(--temple-maroon)] hover:bg-[var(--temple-cream)]",
              ].join(" ")}
            >
              {open ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>

        </div>
      </div>

      {/* ─── Mobile Menu ─── */}
      <div
        className={[
          "fixed inset-x-0 top-0 z-40 lg:hidden transition-all duration-300 ease-out",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        {/* Backdrop */}
        <div
          className={[
            "absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onClick={() => setOpen(false)}
        />

        {/* Menu panel */}
        <div
          className={[
            "relative mx-3 sm:mx-4 mt-20 rounded-2xl overflow-hidden transition-all duration-300 ease-out",
            "border border-[var(--temple-gold-light)]/40",
            "bg-[var(--temple-warm-white)]/95 backdrop-blur-xl",
            "shadow-[0_12px_48px_rgba(0,0,0,0.12)]",
            open
              ? "translate-y-0 scale-100"
              : "-translate-y-4 scale-95",
          ].join(" ")}
          style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", maxHeight: "calc(100vh - 6rem)" }}
        >
          <div className="overflow-y-auto space-y-1 p-4 pb-20" style={{ maxHeight: "calc(100vh - 7rem)" }}>

            {/* Home, Shlokas */}
            {menuItems.map((item) => {

              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={handleMobileNavClick}
                  className={[
                    "flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold border-l-2 border-[var(--temple-gold)]"
                      : "text-stone-700 hover:bg-[var(--temple-cream)]",
                  ].join(" ")}
                >
                  {item.name}
                  <ChevronRight size={16} className="text-stone-400" />
                </Link>
              );

            })}

            {/* ─── Guru Parampara Accordion ─── */}
            <div className="space-y-0.5">
              <button
                onClick={() => setMobileGuruOpen(!mobileGuruOpen)}
                aria-expanded={mobileGuruOpen}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  isGuruParamparaActive
                    ? "text-[var(--temple-maroon)] bg-[var(--temple-cream)]"
                    : "text-stone-500 hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                <BookOpen size={14} />
                Guru Parampara
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 ${mobileGuruOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  mobileGuruOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0",
                ].join(" ")}
              >
                {guruParamparaDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center justify-between rounded-xl px-8 py-3 text-sm transition-all duration-200",
                        active
                          ? "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold"
                          : "text-stone-600 hover:bg-[var(--temple-cream)]",
                      ].join(" ")}
                    >
                      {item.name}
                      <ChevronRight size={16} className="text-stone-400" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ─── Calendar Accordion ─── */}
            <div className="space-y-0.5">
              <button
                onClick={() => setMobileCalendarOpen(!mobileCalendarOpen)}
                aria-expanded={mobileCalendarOpen}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  isCalendarActive
                    ? "text-[var(--temple-maroon)] bg-[var(--temple-cream)]"
                    : "text-stone-500 hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                <Calendar size={14} />
                Calendar
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 ${mobileCalendarOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  mobileCalendarOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0",
                ].join(" ")}
              >
                {calendarDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center justify-between rounded-xl px-8 py-3 text-sm transition-all duration-200",
                        active
                          ? "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold"
                          : "text-stone-600 hover:bg-[var(--temple-cream)]",
                      ].join(" ")}
                    >
                      {item.name}
                      <ChevronRight size={16} className="text-stone-400" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Gallery */}
            <Link
              href="/gallery"
              onClick={handleMobileNavClick}
              className={[
                "flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-medium transition-all duration-200",
                pathname === "/gallery"
                  ? "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold border-l-2 border-[var(--temple-gold)]"
                  : "text-stone-700 hover:bg-[var(--temple-cream)]",
              ].join(" ")}
            >
              Gallery
              <ChevronRight size={16} className="text-stone-400" />
            </Link>

            {/* ─── Events Accordion ─── */}
            <div className="space-y-0.5">
              <button
                onClick={() => setMobileEventsOpen(!mobileEventsOpen)}
                aria-expanded={mobileEventsOpen}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  isEventsActive
                    ? "text-[var(--temple-maroon)] bg-[var(--temple-cream)]"
                    : "text-stone-500 hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                Events
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 ${mobileEventsOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  mobileEventsOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0",
                ].join(" ")}
              >
                {eventsDropdown.map((item) => {
                  const active = pathname === item.href;
                  const isLive = item.name === "Live Darshan";
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center gap-2 rounded-xl px-8 py-3 text-sm transition-all duration-200",
                        isLive
                          ? "bg-red-50/80 text-red-700 font-semibold"
                          : active
                          ? "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold"
                          : "text-stone-600 hover:bg-[var(--temple-cream)]",
                      ].join(" ")}
                    >
                      {isLive && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                        </span>
                      )}
                      {item.name}
                      {isLive ? <ExternalLink size={14} className="ml-auto text-red-400" /> : <ChevronRight size={16} className="ml-auto text-stone-400" />}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ─── About Accordion ─── */}
            <div className="space-y-0.5">
              <button
                onClick={() => setMobileAboutOpen(!mobileAboutOpen)}
                aria-expanded={mobileAboutOpen}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  isAboutActive
                    ? "text-[var(--temple-maroon)] bg-[var(--temple-cream)]"
                    : "text-stone-500 hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                About
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 ${mobileAboutOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  mobileAboutOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0",
                ].join(" ")}
              >
                {aboutDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center justify-between rounded-xl px-8 py-3 text-sm transition-all duration-200",
                        active
                          ? "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold"
                          : "text-stone-600 hover:bg-[var(--temple-cream)]",
                      ].join(" ")}
                    >
                      {item.name}
                      <ChevronRight size={16} className="text-stone-400" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ─── Online Services Accordion ─── */}
            <div className="space-y-0.5 pt-2 border-t border-[var(--temple-gold-light)]/30">
              <button
                onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                aria-expanded={mobileServicesOpen}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  "text-[var(--temple-gold-dark)]",
                  isOnlineServicesActive ? "bg-[var(--temple-cream)]" : "hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                <Heart size={14} />
                Online Services
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 ${mobileServicesOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  mobileServicesOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0",
                ].join(" ")}
              >
                {onlineServicesDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center gap-2 rounded-xl px-8 py-3 text-sm transition-all duration-200",
                        active
                          ? "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold"
                          : "text-stone-600 hover:bg-[var(--temple-cream)]",
                      ].join(" ")}
                    >
                      {item.name === "Donate" && <Heart size={14} className="text-[var(--temple-gold-dark)]" />}
                      {item.name === "Register" && <User size={14} className="text-[var(--temple-gold-dark)]" />}
                      {item.name}
                      <ChevronRight size={16} className="ml-auto text-stone-400" />
                    </Link>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

    </header>
  );
}
