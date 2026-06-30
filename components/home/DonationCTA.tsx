import Link from "next/link";
import { Heart, Landmark, Gift, ArrowRight } from "lucide-react";

export default function DonationCTA() {
  const options = [
    {
      title: "Annadanam",
      desc: "Support daily prasada and meals for devotees.",
      icon: Heart,
    },
    {
      title: "Temple Development",
      desc: "Contribute towards renovation and maintenance.",
      icon: Landmark,
    },
    {
      title: "Special Sevas",
      desc: "Sponsor poojas and religious celebrations.",
      icon: Gift,
    },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-700 to-amber-900 py-24 text-white">

      <div className="absolute inset-0 bg-[url('/images/pattern.png')] opacity-10" />

      <div className="relative mx-auto max-w-7xl px-6">

        <div className="mx-auto max-w-3xl text-center">

          <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur">
            Offer Your Contribution
          </span>

          <h2 className="mt-6 text-4xl font-bold md:text-5xl">
            Support Sri Rayara Matha
          </h2>

          <p className="mt-6 text-lg leading-8 text-amber-100">
            Your generous contribution helps us continue daily poojas,
            annadanam, festivals and preservation of our sacred traditions.
          </p>

        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">

          {options.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur transition hover:bg-white/15"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-amber-700">
                  <Icon size={30} />
                </div>

                <h3 className="mt-6 text-2xl font-bold">
                  {item.title}
                </h3>

                <p className="mt-4 leading-7 text-amber-100">
                  {item.desc}
                </p>
              </div>
            );
          })}

        </div>

        <div className="mt-16 text-center">

          <Link
            href="/donation"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 font-semibold text-amber-800 transition hover:scale-105"
          >
            Donate Now
            <ArrowRight size={18} />
          </Link>

        </div>

      </div>

    </section>
  );
}
