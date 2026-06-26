"use client";

import SectionHeading from "@/components/common/SectionHeading";
import { CalendarDays, ArrowRight } from "lucide-react";

const events = [
  {
    id: 1,
    date: "Every Thursday",
    title: "Special Guruvara Pooja",
    description:
      "Participate in the weekly Guruvara Pooja dedicated to Sri Raghavendra Swamy with Sankalpa and Mangalarati.",
  },
  {
    id: 2,
    date: "Every Ekadashi",
    title: "Vishnu Sahasranama Parayana",
    description:
      "Collective chanting of Vishnu Sahasranama followed by Maha Mangalarati and Theertha Prasada.",
  },
  {
    id: 3,
    date: "Annual Festival",
    title: "Sri Raghavendra Swamy Aradhane",
    description:
      "Grand celebrations including Veda Parayana, Panchamruta Abhisheka, Rathotsava, Bhajane and Annadana.",
  },
  {
    id: 4,
    date: "Every Saturday",
    title: "Hanuman Chalisa",
    description:
      "Evening Hanuman Chalisa recital followed by devotional bhajans and prasada distribution.",
  },
  {
    id: 5,
    date: "Every Sunday",
    title: "Annadana Seva",
    description:
      "Free community meal served to all devotees after the Madhyahna Mahapooja.",
  },
  {
    id: 6,
    date: "Daily 7:00 PM",
    title: "Evening Bhajane",
    description:
      "Daily devotional singing in praise of Sri Hari, Vayu and Guru Raghavendra Swamy.",
  },
];

export default function UpcomingEvents() {
  return (
    <section className="bg-orange-50 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          title="Upcoming Events"
          subtitle="Join us in our spiritual programs, seva activities and temple celebrations."
        />

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 flex items-center gap-2 text-orange-600">
                <CalendarDays className="h-5 w-5" />
                <span className="font-semibold">{event.date}</span>
              </div>

              <h3 className="mb-3 text-xl font-bold text-gray-900">
                {event.title}
              </h3>

              <p className="mb-6 leading-7 text-gray-600">
                {event.description}
              </p>

              <button className="inline-flex items-center gap-2 font-medium text-orange-600 hover:text-orange-700">
                Read More
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
