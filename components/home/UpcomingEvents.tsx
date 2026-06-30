import Link from "next/link";
import { CalendarDays, ArrowRight } from "lucide-react";
import SectionHeading from "@/components/common/SectionHeading";

const events = [
  {
    title: "Guru Aaradhane",
    date: "14 Aug 2026",
    month: "AUG",
    description:
      "Special poojas, bhajans, annadanam and cultural programs throughout the day.",
    href: "/events",
  },
  {
    title: "Hanuman Jayanti",
    date: "29 Aug 2026",
    month: "AUG",
    description:
      "Celebrate with special alankara, Hanuman Chalisa parayana and maha mangalarati.",
    href: "/events",
  },
  {
    title: "Navaratri Utsava",
    date: "03 Oct 2026",
    month: "OCT",
    description:
      "Nine days of devotion with daily pooja, music, discourse and prasada seva.",
    href: "/events",
  },
];

export default function UpcomingEvents() {
  return (
    <section className="bg-gradient-to-b from-white to-amber-50/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          title="Upcoming Events"
          subtitle="Celebrate festivals and spiritual gatherings with us."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {events.map((event) => (
            <article
              key={event.title}
              className="group overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >
              <div className="relative h-48 overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-500">
                <div className="absolute inset-0 bg-black/20" />

                <div className="absolute left-6 top-6 flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-white shadow-xl">
                  <span className="text-xs font-bold tracking-widest text-amber-700">
                    {event.month}
                  </span>
                  <span className="text-3xl font-bold text-stone-900">
                    {event.date.split(" ")[0]}
                  </span>
                </div>

                <CalendarDays className="absolute bottom-6 right-6 h-10 w-10 text-white/80" />
              </div>

              <div className="p-8">
                <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">
                  {event.date}
                </p>

                <h3 className="mt-3 text-2xl font-bold text-stone-900">
                  {event.title}
                </h3>

                <p className="mt-4 leading-7 text-stone-600">
                  {event.description}
                </p>

                <Link
                  href={event.href}
                  className="mt-8 inline-flex items-center gap-2 font-semibold text-amber-700 transition group-hover:gap-3"
                >
                  View Details
                  <ArrowRight size={18} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
