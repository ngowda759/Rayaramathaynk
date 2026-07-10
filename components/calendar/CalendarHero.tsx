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
    <section className="border-b border-amber-100 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50">
      <div className="mx-auto max-w-7xl px-6 py-20 text-center">

        <span className="inline-flex rounded-full bg-amber-100 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
          {badge}
        </span>

        <h1 className="mt-6 text-5xl font-bold text-stone-900">
          {title}
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-stone-600">
          {subtitle}
        </p>

      </div>
    </section>
  );
}
