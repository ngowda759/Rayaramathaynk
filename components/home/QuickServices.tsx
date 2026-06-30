import Link from "next/link";
import {
  CalendarDays,
  HeartHandshake,
  Images,
  HandCoins,
  BookOpen,
  MapPin,
  Phone,
  ChevronRight,
} from "lucide-react";

const services = [
  {
    title: "Daily Pooja",
    description: "Today's pooja schedule and timings",
    icon: CalendarDays,
    href: "/pooja",
    color: "from-orange-500 to-amber-500",
  },
  {
    title: "Special Sevas",
    description: "Book sevas online",
    icon: HeartHandshake,
    href: "/sevas",
    color: "from-red-500 to-orange-500",
  },
  {
    title: "Gallery",
    description: "Temple photos & celebrations",
    icon: Images,
    href: "/gallery",
    color: "from-sky-500 to-cyan-500",
  },
  {
    title: "Donate",
    description: "Support temple activities",
    icon: HandCoins,
    href: "/donation",
    color: "from-emerald-500 to-green-500",
  },
  {
    title: "Temple History",
    description: "Learn about Rayaramatha",
    icon: BookOpen,
    href: "/about",
    color: "from-violet-500 to-purple-500",
  },
  {
    title: "Events",
    description: "Upcoming festivals & utsavas",
    icon: CalendarDays,
    href: "/events",
    color: "from-pink-500 to-rose-500",
  },
  {
    title: "Directions",
    description: "Find your way to the temple",
    icon: MapPin,
    href: "/contact",
    color: "from-indigo-500 to-blue-500",
  },
  {
    title: "Contact Us",
    description: "Temple office information",
    icon: Phone,
    href: "/contact",
    color: "from-teal-500 to-emerald-500",
  },
];

export default function QuickServices() {
  return (
    <section className="bg-gradient-to-b from-stone-50 to-white py-24">
      <div className="mx-auto max-w-7xl px-6">

        <div className="mx-auto max-w-3xl text-center">

          <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-amber-700">
            Explore
          </span>

          <h2 className="mt-6 text-4xl font-bold text-stone-900 md:text-5xl">
            Temple Services
          </h2>

          <p className="mt-5 text-lg leading-8 text-stone-600">
            Everything you need for your spiritual journey—from booking sevas
            and donating to exploring temple history and festivals.
          </p>

        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">

          {services.map((service) => {
            const Icon = service.icon;

            return (
              <Link
                key={service.title}
                href={service.href}
                className="group relative overflow-hidden rounded-3xl border border-stone-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-amber-300 hover:shadow-2xl"
              >
                <div
                  className={`mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${service.color} text-white shadow-lg`}
                >
                  <Icon size={30} />
                </div>

                <h3 className="text-2xl font-bold text-stone-900">
                  {service.title}
                </h3>

                <p className="mt-4 leading-7 text-stone-600">
                  {service.description}
                </p>

                <div className="mt-8 flex items-center font-semibold text-amber-700 transition-all group-hover:translate-x-1">
                  Explore
                  <ChevronRight
                    size={18}
                    className="ml-2 transition-transform group-hover:translate-x-1"
                  />
                </div>

                <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-amber-50 transition-all duration-500 group-hover:scale-150" />

              </Link>
            );
          })}

        </div>

      </div>
    </section>
  );
}
