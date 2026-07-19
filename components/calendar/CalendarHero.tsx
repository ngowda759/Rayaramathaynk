import { Calendar } from "lucide-react";

interface CalendarHeroProps {
  badge: string;
  title: string;
  subtitle: string;
}

export default function CalendarHero({
  badge,
  title,
  subtitle,
}: CalendarHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-12 md:py-16">
      <div className="absolute inset-0 opacity-10">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: "url('/images/Hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 backdrop-blur">
          <Calendar className="h-5 w-5 text-amber-200" />
          <span className="text-sm font-medium text-white">
            {badge}
          </span>
        </div>

        <h1 className="text-4xl font-bold text-white md:text-5xl">
          {title}
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-xl text-amber-100">
          {subtitle}
        </p>
      </div>
    </section>
  );
}
