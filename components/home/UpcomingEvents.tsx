import SectionHeading from "@/components/common/SectionHeading";

const events = [
  {
    title: "Guru Aaradhane",
    date: "14 Aug 2026",
  },
  {
    title: "Hanuman Jayanti",
    date: "29 Aug 2026",
  },
  {
    title: "Navaratri Utsava",
    date: "3 Oct 2026",
  },
];

export default function UpcomingEvents() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">

        <SectionHeading
          title="Upcoming Events"
          subtitle="Join us in our upcoming celebrations"
        />

        <div className="grid gap-8 md:grid-cols-3">

          {events.map((event) => (
            <div
              key={event.title}
              className="rounded-3xl border bg-stone-50 p-8 shadow-sm hover:shadow-lg transition"
            >
              <p className="text-sm text-amber-700 font-semibold">
                {event.date}
              </p>

              <h3 className="mt-3 text-2xl font-bold">
                {event.title}
              </h3>

              <button className="mt-6 rounded-lg bg-amber-600 px-5 py-2 text-white hover:bg-amber-700">
                View Details
              </button>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}
