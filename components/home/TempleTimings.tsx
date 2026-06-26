import { Clock3 } from "lucide-react";

const timings = [
  {
    title: "Morning",
    time: "5:30 AM - 12:30 PM",
  },
  {
    title: "Afternoon",
    time: "12:30 PM - 4:30 PM",
  },
  {
    title: "Evening",
    time: "4:30 PM - 8:30 PM",
  },
];

export default function TempleTimings() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">

        <div className="text-center">

          <Clock3
            className="mx-auto text-amber-600"
            size={48}
          />

          <h2 className="mt-4 text-4xl font-bold">
            Temple Timings
          </h2>

          <p className="mt-3 text-gray-600">
            Darshan timings for devotees
          </p>

        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">

          {timings.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl bg-amber-50 p-8 text-center shadow-md"
            >
              <h3 className="text-2xl font-semibold text-amber-700">
                {item.title}
              </h3>

              <p className="mt-4 text-lg font-medium">
                {item.time}
              </p>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}
