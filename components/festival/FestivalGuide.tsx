import React from "react";
import { Clock, Users, Music, BookOpen, Utensils } from "lucide-react";

interface GuideSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  items: string[];
}

const SAMPLE_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "schedule",
    title: "Typical Schedule",
    description: "A standard day during a major festival.",
    icon: Clock,
    items: [
      "05:00 AM - Suprabhata & Vishesha Pooja",
      "08:00 AM - Maha Mangalarati",
      "10:00 AM - Special Alankara Darshana",
      "12:30 PM - Maha Naivedya & Anna Santharpane",
      "06:30 PM - Evening Bhajans",
      "08:00 PM - Rathotsava (Chariot Procession)",
    ],
  },
  {
    id: "rituals",
    title: "Key Rituals",
    description: "Important religious observances you can expect.",
    icon: BookOpen,
    items: [
      "Panchamrutha Abhisheka",
      "Tulasi Archane",
      "Vishesha Homa/Havana",
      "Pravachana (Spiritual Discourses)",
    ],
  },
  {
    id: "cultural",
    title: "Cultural Programs",
    description: "Evening cultural events and performances.",
    icon: Music,
    items: [
      "Classical Carnatic Music Concerts",
      "Devotional Bhajans by guest artists",
      "Traditional Dance performances",
      "Harikatha and Dasavani",
    ],
  },
  {
    id: "facilities",
    title: "Devotee Facilities",
    description: "Arrangements made for visiting devotees.",
    icon: Users,
    items: [
      "Special Queues for Darshana",
      "Medical Emergency Desk",
      "Drinking Water Stations",
      "Information & Help Desk",
    ],
  },
  {
    id: "prasada",
    title: "Anna Prasada",
    description: "Details about food arrangements.",
    icon: Utensils,
    items: [
      "Free Anna Prasada for all devotees",
      "Special Sweet Distribution",
      "Extended serving hours during festival days",
    ],
  },
];

export default function FestivalGuide() {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-stone-900">What to Expect</h2>
        <p className="mt-4 text-stone-600 max-w-2xl mx-auto">
          Experience the divine atmosphere during our major festivals. Here is a general guide to the schedule, rituals, and arrangements made for devotees.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SAMPLE_GUIDE_SECTIONS.map((section) => (
          <div
            key={section.id}
            className="rounded-2xl border border-stone-100 bg-stone-50 p-6 transition-all hover:shadow-md"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <section.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-stone-900">{section.title}</h3>
            </div>

            <p className="mb-4 text-sm text-stone-600">{section.description}</p>

            <ul className="space-y-2">
              {section.items.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-stone-700">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
