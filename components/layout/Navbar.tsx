"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";

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

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

        <div>
          <h1 className="text-xl font-bold text-amber-700">
            🛕 Sri Raghavendra Swamy Temple
          </h1>

          <p className="text-xs text-gray-500">
            Yelahanka New Town
          </p>
        </div>

        <nav className="hidden lg:flex gap-8">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="font-medium text-gray-700 hover:text-amber-700 transition"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden"
        >
          <Menu />
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t bg-white">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="block px-6 py-3 hover:bg-amber-50"
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
