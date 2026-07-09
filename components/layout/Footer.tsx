"use client";

import Link from "next/link";
import {
  MapPin,
  Phone,
  Mail,
  Clock3,
  Heart,
  ChevronRight,
} from "lucide-react";

const quickLinks = [
  { name: "Home", href: "/" },
  { name: "Aaradhane", href: "/aaradhane" },
  { name: "Facilities", href: "/facilities" },
  { name: "Guru Parampara", href: "/guruparampara" },
  { name: "Gallery", href: "/gallery" },
  { name: "Events", href: "/events" },
  { name: "About", href: "/about" },
];

const sevasLinks = [
  { name: "Daily Pooja", href: "/pooja" },
  { name: "Special Sevas", href: "/sevas" },
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

        <div className="grid gap-14 lg:grid-cols-5">

          {/* Temple */}

          <div>

            <div className="flex items-center gap-4">

              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-4xl shadow-xl">
                🛕
              </div>

              <div>

                <h2 className="text-2xl font-bold text-white">
                  Sri Raghavendra swamy Matha
                </h2>

                <p className="text-amber-400">
                  Yelahanka New Town
                </p>

              </div>

            </div>

            <p className="mt-8 leading-8 text-stone-400">
              Dedicated to Sri Raghavendra Swamy, it is a hub of devotion,
	      Vedantic learning, and Guru Seva, 
	      drawing lakhs of devotees each year..
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

          {/* Sevas */}

          <div>

            <h3 className="mb-8 text-xl font-bold text-white">
              Sevas
            </h3>

            <div className="space-y-4">

              {sevasLinks.map((link) => (

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

  		<a
    		href="https://maps.app.goo.gl/JKqBSh7AdNAC6E9d8"
    		target="_blank"
    		rel="noopener noreferrer"
    		className="hover:text-amber-400 transition"
  		>
    		Sri Rayara Matha
    		<br />
    		Yelahanka New Town
    		<br />
    		Bengaluru
  		</a>
	        
              </div>

              <div className="flex gap-4">

                <Phone className="text-amber-500" />

                <span>+91 9886364462 </span>

              </div>

              <div className="flex gap-4">

                <Mail className="text-amber-500" />

                <span>ngowda759@gmail.com</span>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Copyright Bar */}
      <div className="border-t border-stone-800">

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-stone-400 md:flex-row">

          <p className="flex items-center gap-2">

            © 2026 Sri Raghavendra swamy Matha

            <Heart
              size={15}
              className="fill-red-500 text-red-500"
            />

            Built with devotion.

          </p>

          <p>
            Sri Raghavendra Swamy Matha • Yelahanka New Town
          </p>

        </div>

      </div>

    </footer>
  );
}
