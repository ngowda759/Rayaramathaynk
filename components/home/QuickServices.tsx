import Link from "next/link";
import {
  CalendarDays,
  HeartHandshake,
  Images,
  HandCoins,
} from "lucide-react";

const services = [
  {
    title: "Daily Pooja",
    description: "View today's pooja schedule",
    icon: CalendarDays,
    href: "/pooja",
  },
  {
    title: "Special Sevas",
    description: "Book temple sevas",
    icon: HeartHandshake,
    href: "/sevas",
  },
  {
    title: "Gallery",
    description: "Temple photo gallery",
    icon: Images,
    href: "/gallery",
  },
  {
    title: "Donate",
    description: "Support temple activities",
    icon: HandCoins,
    href: "/donation",
  },
];

export default function QuickServices() {
  return (
    <section className="bg-stone-50 py-20">
      <div className="mx-auto max-w-7xl px-6">

        <div className="text-center">
          <h2 className="text-4xl font-bold">
            Temple Services
          </h2>

          <p className="mt-3 text-gray-600">
            Explore the spiritual services offered by the temple.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">

          {services.map((service) => {
            const Icon = service.icon;

            return (
              <Link
                key={service.title}
                href={service.href}
                className="rounded-3xl bg-white p-8 shadow-md transition hover:-translate-y-2 hover:shadow-xl"
              >
                <Icon className="text-amber-600" size={40} />

                <h3 className="mt-6 text-xl font-bold">
                  {service.title}
                </h3>

                <p className="mt-3 text-gray-600">
                  {service.description}
                </p>
              </Link>
            );
          })}

        </div>

      </div>
    </section>
  );
}
