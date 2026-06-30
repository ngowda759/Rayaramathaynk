import Link from "next/link";
import {
  MapPin,
  Phone,
  Mail,
  Clock3,
  Heart,
  Globe,
  ExternalLink,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-stone-950 text-stone-300">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Temple */}
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-3xl">
                🛕
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">
                  Sri Rayara Matha
                </h3>
                <p className="text-sm text-amber-400">
                  Yelahanka, Bengaluru
                </p>
              </div>
            </div>

            <p className="mt-6 leading-7">
              A sacred place dedicated to Sri Raghavendra Swamy.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-6 text-lg font-semibold text-white">
              Quick Links
            </h4>

            <div className="space-y-3">
              <Link href="/">Home</Link><br />
              <Link href="/pooja">Daily Pooja</Link><br />
              <Link href="/sevas">Sevas</Link><br />
              <Link href="/events">Events</Link><br />
              <Link href="/gallery">Gallery</Link><br />
              <Link href="/donation">Donation</Link>
            </div>
          </div>

          {/* Timings */}
          <div>
            <h4 className="mb-6 text-lg font-semibold text-white">
              Temple Timings
            </h4>

            <div className="space-y-5">
              <div className="flex gap-3">
                <Clock3 className="text-amber-500" />
                <div>
                  <p className="font-semibold text-white">Morning</p>
                  <p>6:00 AM – 1:00 PM</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Clock3 className="text-amber-500" />
                <div>
                  <p className="font-semibold text-white">Evening</p>
                  <p>4:30 PM – 8:30 PM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-6 text-lg font-semibold text-white">
              Contact
            </h4>

            <div className="space-y-4">
              <div className="flex gap-3">
                <MapPin className="text-amber-500" />
                <span>Yelahanka, Bengaluru</span>
              </div>

              <div className="flex gap-3">
                <Phone className="text-amber-500" />
                <span>+91 XXXXX XXXXX</span>
              </div>

              <div className="flex gap-3">
                <Mail className="text-amber-500" />
                <span>info@rayaramatha.org</span>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <a
                href="#"
                className="rounded-xl bg-stone-800 p-3 hover:bg-amber-600"
              >
                <Globe size={18} />
              </a>

              <a
                href="#"
                className="rounded-xl bg-stone-800 p-3 hover:bg-amber-600"
              >
                <ExternalLink size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-stone-800 py-6 text-center text-sm">
        <p className="flex items-center justify-center gap-2">
          © 2026 Sri Rayara Matha • Made with
          <Heart size={14} className="text-red-500" />
          for devotees.
        </p>
      </div>
    </footer>
  );
}
