"use client";

import Link from "next/link";
import { Menu, X, ChevronRight } from "lucide-react";
import { useState } from "react";
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-white/80 backdrop-blur-xl shadow-sm">

      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

        {/* Logo */}

        <Link href="/" className="flex items-center gap-4">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-3xl shadow-lg">
            🛕
          </div>

          <div>

            <h1 className="text-xl font-bold text-stone-900">
              Sri Raghavendra Swamy Temple
            </h1>

            <p className="text-sm text-amber-700">
              Yelahanka New Town, Bengaluru
            </p>

          </div>

        </Link>

        {/* Desktop Menu */}

        <nav className="hidden items-center gap-2 lg:flex">

          {menuItems.map((item) => {

            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`rounded-xl px-4 py-2 font-medium transition ${
                  active
                    ? "bg-amber-100 text-amber-800"
                    : "text-stone-700 hover:bg-amber-50 hover:text-amber-700"
                }`}
              >
                {item.name}
              </Link>
            );
          })}

        </nav>

        {/* Donate Button */}

        <Link
          href="/donation"
          className="hidden rounded-xl bg-amber-600 px-5 py-3 font-semibold text-white transition hover:bg-amber-700 lg:flex"
        >
          Donate
        </Link>

        {/* Mobile Button */}

        <button
          onClick={() => setOpen(!open)}
          className="rounded-xl p-2 hover:bg-stone-100 lg:hidden"
        >
          {open ? <X size={28} /> : <Menu size={28} />}
        </button>

      </div>

      {/* Mobile Menu */}

      {open && (

        <div className="border-t bg-white lg:hidden">

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
                  className={`flex items-center justify-between rounded-xl px-4 py-4 transition ${
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
              className="mt-3 flex justify-center rounded-xl bg-amber-600 px-4 py-4 font-semibold text-white"
            >
              Donate Now
            </Link>

          </div>

        </div>

      )}

    </header>
  );
}
