"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Clock3, IndianRupee } from "lucide-react";
import { SevaItem } from "@/lib/sevas";

interface FeaturedSevasClientProps {
  sevas: SevaItem[];
}

export default function FeaturedSevasClient({ sevas }: FeaturedSevasClientProps) {
  return (
    <section className="bg-[#fffdf8] py-24">
      <div className="mx-auto max-w-7xl px-6">

        <div className="mb-16 text-center">

          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            FEATURED SEVAS
          </span>

          <h2 className="mt-6 text-5xl font-bold text-stone-900">
            Participate in Divine Sevas
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-stone-600">
            Choose from our daily and special sevas offered with devotion
            to Sri Raghavendra Swamy.
          </p>

        </div>

        <div className="grid gap-8 lg:grid-cols-3">

          {sevas.map((seva, index) => (

            <motion.div
              key={seva.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.15 }}
              viewport={{ once: true }}
              className="overflow-hidden rounded-[32px] border border-amber-100 bg-white shadow-lg transition hover:-translate-y-2 hover:shadow-2xl"
            >

              <div className="relative h-60">

                <Image
                  src={seva.image}
                  alt={seva.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                />

              </div>

              <div className="p-8">

                <h3 className="text-2xl font-bold text-stone-900">
                  {seva.title}
                </h3>

                <p className="mt-4 leading-7 text-stone-600">
                  {seva.description}
                </p>

                <div className="mt-6 flex justify-between">

                  <div className="flex items-center gap-2">

                    <IndianRupee
                      className="text-amber-600"
                      size={18}
                    />

                    <span className="font-semibold">
                      {seva.price}
                    </span>

                  </div>

                  <div className="flex items-center gap-2">

                    <Clock3
                      className="text-amber-600"
                      size={18}
                    />

                    <span>
                      {seva.duration}
                    </span>

                  </div>

                </div>

                <Link
                  href="/sevas"
                  className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-semibold text-white transition hover:scale-105"
                >
                  Book Seva
                  <ArrowRight size={18} />
                </Link>

              </div>

            </motion.div>

          ))}

        </div>

      </div>
    </section>
  );
}
