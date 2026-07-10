"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Images } from "lucide-react";
import { GalleryItem } from "@/lib/gallery";

interface TempleGalleryPreviewProps {
  items: GalleryItem[];
}

export default function TempleGalleryPreview({ items }: TempleGalleryPreviewProps) {
  return (
    <section className="bg-gradient-to-b from-white to-[#fff8ef] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            TEMPLE GALLERY
          </span>
          <h2 className="mt-6 text-5xl font-bold text-stone-900">Moments of Devotion</h2>
          <p className="mt-6 text-lg leading-8 text-stone-600">
            Experience the beauty of our temple through festivals, daily poojas and memorable spiritual celebrations.
          </p>
        </div>

        <div className="mt-16 grid auto-rows-[220px] grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <motion.div
              key={item.image}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`group relative overflow-hidden rounded-[30px] shadow-xl ${item.size}`}
            >
              <Image
                src={item.image}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="object-cover transition duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-6 left-6">
                <h3 className="text-2xl font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-white/80">Sri Rayara Matha</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 rounded-[32px] bg-gradient-to-r from-amber-600 to-orange-500 p-10 text-white">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            <div className="flex items-center gap-5">
              <div className="rounded-2xl bg-white/20 p-4">
                <Images size={34} />
              </div>
              <div>
                <h3 className="text-3xl font-bold">Explore Our Complete Gallery</h3>
                <p className="mt-2 text-amber-100">Festivals • Poojas • Annadanam • Celebrations</p>
              </div>
            </div>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 font-semibold text-amber-700 transition hover:scale-105"
            >
              View Gallery
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
