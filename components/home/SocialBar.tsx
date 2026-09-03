"use client";

import Link from "next/link";
import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
} from "react-icons/fa";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { settingsService, type SocialLinksData } from "@/services/settings.service";

export default function SocialBar() {
  const [links, setLinks] = useState<SocialLinksData | null>(null);

  useEffect(() => {
    let active = true;
    settingsService
      .getSocialLinks()
      .then((data) => {
        if (active) setLinks(data);
      })
      .catch((error) => {
        console.error("Error fetching social links:", error);
        if (active) setLinks(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!links) {
    return <section className="bg-stone-900 py-8" />;
  }

  const socialLinks = [
    {
      href: links.facebook,
      show: links.showFacebook,
      icon: <FaFacebookF size={20} />,
      label: "Facebook",
      className: "bg-blue-600 hover:bg-blue-700",
    },
    {
      href: links.instagram,
      show: links.showInstagram,
      icon: <FaInstagram size={20} />,
      label: "Instagram",
      className: "bg-gradient-to-r from-pink-500 to-purple-600",
    },
    {
      href: links.youtube,
      show: links.showYoutube,
      icon: <FaYoutube size={20} />,
      label: "YouTube",
      className: "bg-red-600 hover:bg-red-700",
    },
    {
      href: links.whatsapp,
      show: links.showWhatsapp,
      icon: <FaWhatsapp size={20} />,
      label: "WhatsApp",
      className: "bg-green-500 hover:bg-green-600",
    },
    {
      href: links.mapUrl,
      show: links.showMap,
      icon: <MapPin size={20} />,
      label: "Location",
      className: "bg-amber-600 hover:bg-amber-700",
    },
  ].filter((s) => s.href && s.show);

  if (socialLinks.length === 0) {
    return <section className="bg-stone-900 py-8" />;
  }

  return (
    <section className="bg-stone-900 py-8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap justify-center gap-4">
          {socialLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-full px-6 py-3 text-white transition-all hover:scale-105 ${link.className}`}
            >
              {link.icon}
              <span className="font-medium">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
