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

  // Accessibility refs for mobile dialog focus management
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  // Scroll position & body style restoration refs
  const scrollPositionRef = useRef(0);
  const isFirstRender = useRef(true);
  const wasOpenRef = useRef(false);
  const prevBodyStyles = useRef<{
    overflow: string;
    position: string;
    width: string;
    top: string;
    touchAction: string;
  } | null>(null);

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

  // Scroll detection for navbar settling effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Safe body scroll locking and precise style/position restoration
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (open) {
      scrollPositionRef.current = window.scrollY;
      prevBodyStyles.current = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        width: document.body.style.width,
        top: document.body.style.top,
        touchAction: document.body.style.touchAction,
      };

      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.touchAction = "none";
    } else {
      if (prevBodyStyles.current) {
        document.body.style.overflow = prevBodyStyles.current.overflow;
        document.body.style.position = prevBodyStyles.current.position;
        document.body.style.width = prevBodyStyles.current.width;
        document.body.style.top = prevBodyStyles.current.top;
        document.body.style.touchAction = prevBodyStyles.current.touchAction;
        prevBodyStyles.current = null;
      } else {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.top = "";
        document.body.style.touchAction = "";
      }
      window.scrollTo({ top: scrollPositionRef.current, behavior: "instant" as ScrollBehavior });
    }

    return () => {
      if (prevBodyStyles.current) {
        document.body.style.overflow = prevBodyStyles.current.overflow;
        document.body.style.position = prevBodyStyles.current.position;
        document.body.style.width = prevBodyStyles.current.width;
        document.body.style.top = prevBodyStyles.current.top;
        document.body.style.touchAction = prevBodyStyles.current.touchAction;
        prevBodyStyles.current = null;
      }
    };
  }, [open]);

  // Focus management: initial focus on open, return focus on close
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      const focusClose = () => {
        closeButtonRef.current?.focus();
      };
      focusClose();
      const raf = requestAnimationFrame(focusClose);
      const timer = setTimeout(focusClose, 100);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const timer = setTimeout(() => {
        menuTriggerRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Focus trapping within mobile dialog
  useEffect(() => {
    if (!open) return;

    function handleFocusTrap(e: KeyboardEvent) {
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusableSelectors =
        'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
      ).filter((el) => el.offsetParent !== null || el === closeButtonRef.current);

      if (focusables.length === 0) return;

      const firstElement = focusables[0];
      const lastElement = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
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

  // Close dropdowns and mobile menu on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGuruParamparaOpen(false);
        setEventsOpen(false);
        setAboutOpen(false);
        setOnlineServicesOpen(false);
        setCalendarOpen(false);
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
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
    "text-[var(--temple-maroon)] hover:bg-[var(--temple-cream)] hover:scale-[1.01] hover:-translate-y-px motion-reduce:hover:transform-none";

  /* ─── Dropdown item classes ─── */
  const dropdownActiveClass =
    "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold border-l-2 border-[var(--temple-gold)]";
  const dropdownInactiveClass =
    "text-stone-700 hover:bg-[var(--temple-cream)] hover:text-[var(--temple-maroon)]";

  return (
    <header className="sticky top-0 z-50 flex w-full justify-center px-3 sm:px-4 lg:px-6 pb-3.5 sm:pb-4.5 lg:pb-5">
      {/* Floating glass container */}
      <div
        className={[
          "mt-2 sm:mt-2.5 lg:mt-3 w-full max-w-[1400px] transition-all duration-500 ease-out",
          "motion-reduce:transition-none",
          "rounded-3xl",
          "border border-[var(--temple-gold-light)]/40",
          scrolled
            ? "bg-[var(--temple-warm-white)]/85 shadow-[0_4px_24px_0_rgba(0,0,0,0.08)] backdrop-blur-xl py-0"
            : "bg-[var(--temple-warm-white)]/60 shadow-[0_2px_12px_0_rgba(0,0,0,0.04)] backdrop-blur-md py-1",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex items-center justify-between px-3 sm:px-5 xl:px-6 2xl:px-8 transition-all duration-500 ease-out",
            "motion-reduce:transition-none",
            scrolled ? "h-16" : "h-[4.5rem]",
          ].join(" ")}
        >

          {/* ─── Brand Area ─── */}
          <Link
            href="/"
            className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0 min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-offset-2"
          >
            <Image
              src="/images/logos/ynk_matha_logo.png"
              alt="Sri Raghavendra Swamy Matha Logo"
              width={48}
              height={48}
              className={[
                "rounded-full object-cover flex-shrink-0 transition-all duration-500 ease-out",
                "motion-reduce:transition-none",
                "border-2 border-[var(--temple-gold)]/30",
                "shadow-[0_0_12px_var(--temple-gold)/15]",
                scrolled ? "w-9 h-9 sm:w-10 sm:h-10" : "w-10 h-10 sm:w-12 sm:h-12",
              ].join(" ")}
            />

            <div className="flex flex-col min-w-0">
              <h1 className="text-xs sm:text-base xl:text-base 2xl:text-lg font-bold text-[var(--temple-maroon)] leading-tight truncate">
                Sri Raghavendra Swamy Matha
              </h1>

              <p className="text-[10px] sm:text-xs text-[var(--temple-gold-dark)] tracking-wide truncate">
                Yelahanka New Town
              </p>
            </div>
          </Link>

          {/* ─── Desktop Navigation (xl:flex: active on 1280px, 1440px, 1920px) ─── */}
          <nav
            className="hidden items-center gap-0.5 xl:gap-1 2xl:gap-1.5 xl:flex"
            role="navigation"
            aria-label="Main navigation"
          >

            {menuItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={[
                    "rounded-full px-3 py-2 text-xs 2xl:text-sm font-medium transition-all duration-300 ease-out",
                    "motion-reduce:transition-none motion-reduce:transform-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-offset-2",
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
                aria-controls="desktop-guru-dropdown"
                className={[
                  "flex items-center gap-1.5 rounded-full px-3 py-2 text-xs 2xl:text-sm font-medium transition-all duration-300 ease-out",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-offset-2",
                  isGuruParamparaActive ? activePillClass : inactivePillClass,
                ].join(" ")}
              >
                <BookOpen size={15} />
                Guru Parampara
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 motion-reduce:transition-none ${guruParamparaOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="desktop-guru-dropdown"
                role="menu"
                aria-orientation="vertical"
                aria-hidden={!guruParamparaOpen}
                className={[
                  "absolute left-0 top-full mt-2 w-56 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/95 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  guruParamparaOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto visible"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none invisible",
                ].join(" ")}
              >
                {guruParamparaDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      role="menuitem"
                      tabIndex={guruParamparaOpen ? 0 : -1}
                      onClick={() => {
                        setGuruParamparaOpen(false);
                        setOpen(false);
                      }}
                      className={[
                        "block px-4 py-3 text-xs 2xl:text-sm transition-all duration-200",
                        "motion-reduce:transition-none",
                        "focus-visible:outline-none focus-visible:bg-[var(--temple-cream)] focus-visible:text-[var(--temple-maroon)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--temple-gold)]",
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
                aria-controls="desktop-calendar-dropdown"
                className={[
                  "flex items-center gap-1.5 rounded-full px-3 py-2 text-xs 2xl:text-sm font-medium transition-all duration-300 ease-out",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-offset-2",
                  isCalendarActive ? activePillClass : inactivePillClass,
                ].join(" ")}
              >
                <Calendar size={15} />
                Calendar
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 motion-reduce:transition-none ${calendarOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="desktop-calendar-dropdown"
                role="menu"
                aria-orientation="vertical"
                aria-hidden={!calendarOpen}
                className={[
                  "absolute left-0 top-full mt-2 w-52 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/95 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  calendarOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto visible"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none invisible",
                ].join(" ")}
              >
                {calendarDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      role="menuitem"
                      tabIndex={calendarOpen ? 0 : -1}
                      onClick={() => {
                        setCalendarOpen(false);
                        setOpen(false);
                      }}
                      className={[
                        "block px-4 py-3 text-xs 2xl:text-sm transition-all duration-200",
                        "motion-reduce:transition-none",
                        "focus-visible:outline-none focus-visible:bg-[var(--temple-cream)] focus-visible:text-[var(--temple-maroon)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--temple-gold)]",
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
                "rounded-full px-3 py-2 text-xs 2xl:text-sm font-medium transition-all duration-300 ease-out",
                "motion-reduce:transition-none motion-reduce:transform-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-offset-2",
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
                aria-controls="desktop-events-dropdown"
                className={[
                  "flex items-center gap-1 rounded-full px-3 py-2 text-xs 2xl:text-sm font-medium transition-all duration-300 ease-out",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-offset-2",
                  isEventsActive ? activePillClass : inactivePillClass,
                ].join(" ")}
              >
                Events
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 motion-reduce:transition-none ${eventsOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="desktop-events-dropdown"
                role="menu"
                aria-orientation="vertical"
                aria-hidden={!eventsOpen}
                className={[
                  "absolute left-0 top-full mt-2 w-52 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/95 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  eventsOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto visible"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none invisible",
                ].join(" ")}
              >
                {eventsDropdown.map((item) => {
                  const active = pathname === item.href;
                  const isLive = item.name === "Live Darshan";
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      role="menuitem"
                      tabIndex={eventsOpen ? 0 : -1}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={() => {
                        setEventsOpen(false);
                        setOpen(false);
                      }}
                      className={[
                        "flex items-center gap-2 px-4 py-3 text-xs 2xl:text-sm transition-all duration-200",
                        "motion-reduce:transition-none",
                        "focus-visible:outline-none focus-visible:bg-[var(--temple-cream)] focus-visible:text-[var(--temple-maroon)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--temple-gold)]",
                        isLive
                          ? "bg-red-50/80 text-red-700 font-semibold hover:bg-red-100/80"
                          : active
                          ? dropdownActiveClass
                          : dropdownInactiveClass,
                      ].join(" ")}
                    >
                      {isLive && (
                        <span className="relative flex h-2 w-2" aria-hidden="true">
                          <span className="absolute inline-flex h-full w-full animate-ping motion-reduce:animate-none rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                        </span>
                      )}
                      {item.name}
                      {isLive && <ExternalLink size={12} className="ml-auto text-red-400" aria-label="(opens external link)" />}
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
                aria-controls="desktop-about-dropdown"
                className={[
                  "flex items-center gap-1 rounded-full px-3 py-2 text-xs 2xl:text-sm font-medium transition-all duration-300 ease-out",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-offset-2",
                  isAboutActive ? activePillClass : inactivePillClass,
                ].join(" ")}
              >
                About
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 motion-reduce:transition-none ${aboutOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="desktop-about-dropdown"
                role="menu"
                aria-orientation="vertical"
                aria-hidden={!aboutOpen}
                className={[
                  "absolute left-0 top-full mt-2 w-52 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/95 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  aboutOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto visible"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none invisible",
                ].join(" ")}
              >
                {aboutDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      role="menuitem"
                      tabIndex={aboutOpen ? 0 : -1}
                      onClick={() => {
                        setAboutOpen(false);
                        setOpen(false);
                      }}
                      className={[
                        "block px-4 py-3 text-xs 2xl:text-sm transition-all duration-200",
                        "motion-reduce:transition-none",
                        "focus-visible:outline-none focus-visible:bg-[var(--temple-cream)] focus-visible:text-[var(--temple-maroon)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--temple-gold)]",
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
                aria-controls="desktop-services-dropdown"
                className={[
                  "flex items-center gap-1.5 rounded-full px-4 2xl:px-5 py-2 text-xs 2xl:text-sm font-semibold transition-all duration-300 ease-out",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "bg-[var(--temple-gold)] text-[var(--temple-maroon)]",
                  "shadow-[0_2px_12px_var(--temple-gold)/30]",
                  "hover:shadow-[0_4px_16px_var(--temple-gold)/40] hover:brightness-105",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-maroon)] focus-visible:ring-offset-2",
                  isOnlineServicesActive ? "ring-2 ring-[var(--temple-maroon)]/20 ring-offset-1" : "",
                ].join(" ")}
              >
                <Heart size={15} />
                Online Services
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 motion-reduce:transition-none ${onlineServicesOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="desktop-services-dropdown"
                role="menu"
                aria-orientation="vertical"
                aria-hidden={!onlineServicesOpen}
                className={[
                  "absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden transition-all duration-200 ease-out origin-top",
                  "motion-reduce:transition-none motion-reduce:transform-none",
                  "border border-[var(--temple-gold-light)]/40",
                  "bg-[var(--temple-warm-white)]/95 backdrop-blur-xl",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.1)]",
                  onlineServicesOpen
                    ? "opacity-100 scale-100 translate-y-0 pointer-events-auto visible"
                    : "opacity-0 scale-95 -translate-y-1 pointer-events-none invisible",
                ].join(" ")}
              >
                {onlineServicesDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      role="menuitem"
                      tabIndex={onlineServicesOpen ? 0 : -1}
                      onClick={() => {
                        setOnlineServicesOpen(false);
                        setOpen(false);
                      }}
                      className={[
                        "flex items-center gap-2 px-4 py-3 text-xs 2xl:text-sm transition-all duration-200",
                        "motion-reduce:transition-none",
                        "focus-visible:outline-none focus-visible:bg-[var(--temple-cream)] focus-visible:text-[var(--temple-maroon)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--temple-gold)]",
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

          {/* ─── Mobile Controls (Active on <1280px: 375, 390, 430, 1024, 1100) ─── */}
          <div className="flex items-center gap-1.5 sm:gap-2 xl:hidden">
            {/* Quick Donate CTA */}
            <Link
              href="/donation"
              className={[
                "flex items-center gap-1 rounded-full px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold transition-all duration-300",
                "bg-[var(--temple-gold)] text-[var(--temple-maroon)]",
                "shadow-[0_2px_8px_var(--temple-gold)/25]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-maroon)] focus-visible:ring-offset-2",
              ].join(" ")}
            >
              <Heart size={13} />
              Donate
            </Link>

            {/* Menu trigger button */}
            <button
              ref={menuTriggerRef}
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={open}
              aria-controls="mobile-navigation-dialog"
              className={[
                "rounded-xl p-1.5 sm:p-2 transition-all duration-200",
                "text-[var(--temple-maroon)] hover:bg-[var(--temple-cream)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-offset-2",
              ].join(" ")}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

        </div>
      </div>

      {/* ─── Mobile Overlay Dialog (Active on <1280px) ─── */}
      <div
        id="mobile-navigation-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className={[
          "fixed inset-0 z-50 flex flex-col p-3 sm:p-4 xl:hidden transition-all duration-300 ease-out",
          "motion-reduce:transition-none",
          open
            ? "opacity-100 pointer-events-auto visible"
            : "opacity-0 pointer-events-none invisible",
        ].join(" ")}
      >
        {/* Backdrop (tap to close) */}
        <div
          className={[
            "fixed inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-300",
            "motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />

        {/* Modal Dialog Content */}
        <div
          ref={dialogRef}
          className={[
            "relative z-10 flex flex-col w-full max-w-lg mx-auto max-h-[calc(100dvh-2rem)] rounded-3xl overflow-hidden transition-all duration-300 ease-out",
            "motion-reduce:transition-none motion-reduce:transform-none",
            "border border-[var(--temple-gold-light)]/40",
            "bg-[var(--temple-warm-white)]/95 backdrop-blur-2xl",
            "shadow-[0_16px_48px_rgba(0,0,0,0.18)]",
            open
              ? "translate-y-0 scale-100"
              : "-translate-y-4 scale-95",
          ].join(" ")}
        >
          {/* Pinned Modal Header (Never scrolls away) */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--temple-gold-light)]/30 bg-[var(--temple-warm-white)]/90 flex-shrink-0">
            <Link
              href="/"
              onClick={handleMobileNavClick}
              tabIndex={open ? 0 : -1}
              className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] rounded-xl"
            >
              <Image
                src="/images/logos/ynk_matha_logo.png"
                alt="Sri Raghavendra Swamy Matha"
                width={36}
                height={36}
                className="rounded-full object-cover border border-[var(--temple-gold)]/40 w-9 h-9 flex-shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold text-[var(--temple-maroon)] leading-tight">
                  Sri Raghavendra Swamy Matha
                </span>
                <span className="text-[10px] text-[var(--temple-gold-dark)]">
                  Yelahanka New Town
                </span>
              </div>
            </Link>

            <button
              ref={closeButtonRef}
              onClick={() => setOpen(false)}
              tabIndex={0}
              aria-label="Close navigation dialog"
              className="rounded-xl p-2 text-[var(--temple-maroon)] hover:bg-[var(--temple-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)]"
            >
              <X size={22} />
            </button>
          </div>

          {/* Scrollable Navigation List */}
          <nav
            aria-label="Mobile navigation"
            className="overflow-y-auto overscroll-contain p-4 pb-12 space-y-1 flex-1"
            style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
          >
            {/* Home, Shlokas */}
            {menuItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  tabIndex={open ? 0 : -1}
                  onClick={handleMobileNavClick}
                  className={[
                    "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
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
                aria-controls="mobile-guru-accordion"
                tabIndex={open ? 0 : -1}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
                  isGuruParamparaActive
                    ? "text-[var(--temple-maroon)] bg-[var(--temple-cream)]"
                    : "text-stone-600 hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                <BookOpen size={15} />
                Guru Parampara
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 motion-reduce:transition-none ${mobileGuruOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="mobile-guru-accordion"
                role="region"
                aria-label="Guru Parampara sub-navigation"
                aria-hidden={!mobileGuruOpen}
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  "motion-reduce:transition-none",
                  mobileGuruOpen ? "max-h-60 opacity-100 visible" : "max-h-0 opacity-0 invisible",
                ].join(" ")}
              >
                {guruParamparaDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      tabIndex={open && mobileGuruOpen ? 0 : -1}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center justify-between rounded-xl px-8 py-2.5 text-sm transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
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
                aria-controls="mobile-calendar-accordion"
                tabIndex={open ? 0 : -1}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
                  isCalendarActive
                    ? "text-[var(--temple-maroon)] bg-[var(--temple-cream)]"
                    : "text-stone-600 hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                <Calendar size={15} />
                Calendar
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 motion-reduce:transition-none ${mobileCalendarOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="mobile-calendar-accordion"
                role="region"
                aria-label="Calendar sub-navigation"
                aria-hidden={!mobileCalendarOpen}
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  "motion-reduce:transition-none",
                  mobileCalendarOpen ? "max-h-40 opacity-100 visible" : "max-h-0 opacity-0 invisible",
                ].join(" ")}
              >
                {calendarDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      tabIndex={open && mobileCalendarOpen ? 0 : -1}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center justify-between rounded-xl px-8 py-2.5 text-sm transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
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
              tabIndex={open ? 0 : -1}
              onClick={handleMobileNavClick}
              className={[
                "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
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
                aria-controls="mobile-events-accordion"
                tabIndex={open ? 0 : -1}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
                  isEventsActive
                    ? "text-[var(--temple-maroon)] bg-[var(--temple-cream)]"
                    : "text-stone-600 hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                Events
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 motion-reduce:transition-none ${mobileEventsOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="mobile-events-accordion"
                role="region"
                aria-label="Events sub-navigation"
                aria-hidden={!mobileEventsOpen}
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  "motion-reduce:transition-none",
                  mobileEventsOpen ? "max-h-60 opacity-100 visible" : "max-h-0 opacity-0 invisible",
                ].join(" ")}
              >
                {eventsDropdown.map((item) => {
                  const active = pathname === item.href;
                  const isLive = item.name === "Live Darshan";
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      tabIndex={open && mobileEventsOpen ? 0 : -1}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center gap-2 rounded-xl px-8 py-2.5 text-sm transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
                        isLive
                          ? "bg-red-50/80 text-red-700 font-semibold"
                          : active
                          ? "bg-[var(--temple-maroon)]/10 text-[var(--temple-maroon)] font-semibold"
                          : "text-stone-600 hover:bg-[var(--temple-cream)]",
                      ].join(" ")}
                    >
                      {isLive && (
                        <span className="relative flex h-2 w-2" aria-hidden="true">
                          <span className="absolute inline-flex h-full w-full animate-ping motion-reduce:animate-none rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                        </span>
                      )}
                      {item.name}
                      {isLive ? <ExternalLink size={14} className="ml-auto text-red-400" aria-label="(opens external link)" /> : <ChevronRight size={16} className="ml-auto text-stone-400" />}
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
                aria-controls="mobile-about-accordion"
                tabIndex={open ? 0 : -1}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
                  isAboutActive
                    ? "text-[var(--temple-maroon)] bg-[var(--temple-cream)]"
                    : "text-stone-600 hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                About
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 motion-reduce:transition-none ${mobileAboutOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="mobile-about-accordion"
                role="region"
                aria-label="About sub-navigation"
                aria-hidden={!mobileAboutOpen}
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  "motion-reduce:transition-none",
                  mobileAboutOpen ? "max-h-60 opacity-100 visible" : "max-h-0 opacity-0 invisible",
                ].join(" ")}
              >
                {aboutDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      tabIndex={open && mobileAboutOpen ? 0 : -1}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center justify-between rounded-xl px-8 py-2.5 text-sm transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
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
                aria-controls="mobile-services-accordion"
                tabIndex={open ? 0 : -1}
                className={[
                  "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-all duration-200 rounded-xl",
                  "text-[var(--temple-gold-dark)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
                  isOnlineServicesActive ? "bg-[var(--temple-cream)]" : "hover:bg-[var(--temple-cream)]/60",
                ].join(" ")}
              >
                <Heart size={15} />
                Online Services
                <ChevronDown
                  size={14}
                  className={`ml-auto transition-transform duration-200 motion-reduce:transition-none ${mobileServicesOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                id="mobile-services-accordion"
                role="region"
                aria-label="Online Services sub-navigation"
                aria-hidden={!mobileServicesOpen}
                className={[
                  "overflow-hidden transition-all duration-300 ease-out",
                  "motion-reduce:transition-none",
                  mobileServicesOpen ? "max-h-60 opacity-100 visible" : "max-h-0 opacity-0 invisible",
                ].join(" ")}
              >
                {onlineServicesDropdown.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      tabIndex={open && mobileServicesOpen ? 0 : -1}
                      onClick={handleMobileNavClick}
                      className={[
                        "flex items-center gap-2 rounded-xl px-8 py-2.5 text-sm transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--temple-gold)] focus-visible:ring-inset",
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

          </nav>
        </div>
      </div>

    </header>
  );
}
