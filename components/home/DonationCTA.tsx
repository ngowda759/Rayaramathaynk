import { HeartHandshake } from "lucide-react";

export default function DonationCTA() {
  return (
    <section className="bg-gradient-to-r from-orange-600 to-amber-500 py-20 text-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 text-center">
        <HeartHandshake className="mb-6 h-16 w-16" />

        <h2 className="text-4xl font-bold">
          Support Sri Raghavendra Swamy Temple
        </h2>

        <p className="mt-6 max-w-3xl text-lg text-orange-100">
          Your generous contribution helps preserve our traditions, support
          daily poojas, annadana, temple maintenance, and community welfare
          activities.
        </p>

        <button className="mt-10 rounded-full bg-white px-8 py-4 font-semibold text-orange-600 shadow-lg transition hover:scale-105">
          Donate Now
        </button>
      </div>
    </section>
  );
}
