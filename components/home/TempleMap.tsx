"use client";

import { motion } from "framer-motion";
import { MapPin, Phone, Navigation } from "lucide-react";

interface TempleMapProps {
  lat?: number;
  lon?: number;
  templeAddress?: string;
  templeName?: string;
  phone?: string;
}

export default function TempleMap({
  lat = 13.1295,
  lon = 77.5859,
  templeAddress = "Yelahanka New Town, Bengaluru, Karnataka",
  templeName = "Sri Raghavendra Swamy Mutt",
  phone = "+91 80 2332 3456",
}: TempleMapProps) {
  const mapsUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.5555555!2d${lon}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s!2zMTPCsDcnNDQuNiJOIDc3wrA1MycyMS4yIkU!5e0!3m2!1sen!2sin!4v1234567890`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=ChIJ_6Jpm1DMzjsRlzHHKi3H8dQ`;

  return (
    <section className="bg-gradient-to-b from-white to-[#fff9ef] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <span className="rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700">
            FIND US ON THE MAP
          </span>
          <h2 className="mt-5 text-4xl font-bold text-stone-900">
            Visit Our Sacred Temple
          </h2>
          <p className="mt-4 text-stone-600">
            Sri Raghavendra Swamy Mutt is located in the heart of Yelahanka
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="mt-14 grid gap-8 lg:grid-cols-2"
        >
          {/* Map */}
          <div>
            <div className="overflow-hidden rounded-3xl shadow-2xl border border-amber-100">
              <iframe
                width="100%"
                height="450"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={mapsUrl}
                className="w-full"
              />
            </div>
          </div>

          {/* Info Card */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="rounded-3xl border border-amber-100 bg-white p-8 shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex-shrink-0">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">Address</h3>
                    <p className="mt-2 text-sm text-stone-600">
                      {templeAddress}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="rounded-3xl border border-amber-100 bg-white p-8 shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex-shrink-0">
                    <Phone size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900">Contact</h3>
                    <p className="mt-2 text-sm text-stone-600">
                      <a
                        href={`tel:${phone.replace(/\s/g, "")}`}
                        className="text-amber-600 hover:text-amber-700 font-medium"
                      >
                        {phone}
                      </a>
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-4 font-medium text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Navigation size={20} />
              Get Directions
            </motion.a>
          </div>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-14 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-8 text-center"
        >
          <h3 className="text-2xl font-bold text-stone-900">Visiting Hours</h3>
          <p className="mt-4 text-stone-600">
            <span className="font-semibold text-stone-900">Morning:</span> 6:00 AM - 1:00 PM
          </p>
          <p className="mt-2 text-stone-600">
            <span className="font-semibold text-stone-900">Evening:</span> 4:00 PM - 8:00 PM
          </p>
          <p className="mt-4 text-sm text-stone-500">
            Closed on Mondays • Special Timings on Festivals
          </p>
        </motion.div>
      </div>
    </section>
  );
}
