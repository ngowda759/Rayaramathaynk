"use client";

import Link from "next/link";
import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
} from "react-icons/fa";
import { MapPin } from "lucide-react";

export default function SocialBar() {
  return (
    <section className="bg-stone-900 py-8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="https://www.facebook.com/srs.mutt.yelahanka.newtown"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-white transition-all hover:scale-105 hover:bg-blue-700"
          >
            <FaFacebookF size={20} />
            <span className="font-medium">Facebook</span>
          </Link>

          <Link
            href="https://www.instagram.com/srs_mutt_yelahanka_newtown"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-white transition-all hover:scale-105"
          >
            <FaInstagram size={20} />
            <span className="font-medium">Instagram</span>
          </Link>

          <Link
            href="https://www.youtube.com/@Guru_Raghavendra_Rayaru"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-white transition-all hover:scale-105 hover:bg-red-700"
          >
            <FaYoutube size={20} />
            <span className="font-medium">YouTube</span>
          </Link>

          <Link
            href="https://whatsapp.com/channel/0029VbDCCue5Ejy3d6EQfh1g"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 text-white transition-all hover:scale-105 hover:bg-green-600"
          >
            <FaWhatsapp size={20} />
            <span className="font-medium">WhatsApp</span>
          </Link>

          <Link
            href="https://maps.app.goo.gl/JKqBSh7AdNAC6E9d8"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-amber-600 px-6 py-3 text-white transition-all hover:scale-105 hover:bg-amber-700"
          >
            <MapPin size={20} />
            <span className="font-medium">Location</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
