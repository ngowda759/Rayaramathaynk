"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronRight, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const menuItems = [
  { name: "Home", href: "/" },
  { name: "Daily Pooja", href: "/pooja" },
  { name: "Special Sevas", href: "/sevas" },
  { name: "Aaradhane", href: "/aaradhane" },
  { name: "Donation", href: "/donation" },
  { name: "Gallery", href: "/gallery" },
  { name: "Events", href: "/events" },
  { name: "About", href: "/about" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);

    onScroll();

    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
              Sri Raghavendra Swamy Temple
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
