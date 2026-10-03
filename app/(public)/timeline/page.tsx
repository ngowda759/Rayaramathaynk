"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Clock,
  Calendar,
  History,
  Landmark,
  Users,
  Construction,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";

interface TimelineEvent {
  id: string;
  year: string;
  title: string;
  description: string;
  category: "history" | "guru" | "construction" | "festival" | "event";
  image?: string;
  details?: string;
}

const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: "e1",
    year: "1595",
    title: "Birth of Sri Raghavendra Swamy",
    description: "Sri Raghavendra Swamy was born in 1595 in a village called Bhai in Karnataka.",
    category: "history",
    details: "Born during the auspicious season, he displayed divine qualities from childhood.",
  },
  {
    id: "e2",
    year: "1616",
    title: "Initiated as Sanyasi",
    description: "Entered the monastic order and became a disciple of Sri Sudhendra Teertha.",
    category: "guru",
    details: "Received Diksha from his Guru and took to the path of renunciation.",
  },
  {
    id: "e3",
    year: "1622",
    title: "Ascension to Mantap",
    description: "Entered Brindavan Brindavan Brindavan at Mantap in Kumbakonam.",
    category: "guru",
    details: "Entered Samadhi at the young age of 27, but continued to bless devotees through his Brindavan.",
  },
  {
    id: "e4",
    year: "1670",
    title: "Establishment of Yelahanka Matha",
    description: "The Yelahanka Matha was established as a center for spiritual activities.",
    category: "construction",
    details: "The Matha became a beacon of knowledge and spiritual guidance for devotees.",
  },
  {
    id: "e5",
    year: "1730",
    title: "Temple Construction Began",
    description: "Construction of the main temple complex commenced under the guidance of the Matha.",
    category: "construction",
    details: "Dedicated efforts by successive pontiffs led to the establishment of this sacred shrine.",
  },
  {
    id: "e6",
    year: "1775",
    title: "First Guru Parampara",
    description: "Establishment of the first Guru Parampara lineage at the Matha.",
    category: "guru",
    details: "The tradition of Gurus continued with subsequent pontiffs taking over the spiritual leadership.",
  },
  {
    id: "e7",
    year: "1800",
    title: "Introduction of Aaradhane",
    description: "Daily Aaradhane ceremony was formalized at the temple.",
    category: "festival",
    details: "The sacred tradition of daily worship and recitation of mantras was established.",
  },
  {
    id: "e8",
    year: "1850",
    title: "Temple Expansion",
    description: "Major expansion of the temple with addition of new shrines.",
    category: "construction",
    details: "New sanctum, prakaras, and gopuram were added to accommodate growing devotees.",
  },
  {
    id: "e9",
    year: "1875",
    title: "Annual Festival Started",
    description: "The first annual festival celebrating Sri Raghavendra Jayanti began.",
    category: "festival",
    details: "Thousands of devotees gathered for the grand celebration of the Guru's birthday.",
  },
  {
    id: "e10",
    year: "1900",
    title: "Modern Amenities Added",
    description: "Introduction of modern facilities for devotees.",
    category: "event",
    details: "Dharmashala, annadanam hall, and other facilities were established.",
  },
  {
    id: "e11",
    year: "1950",
    title: "Copper Shrine Roof",
    description: "Installation of copper roof on the main sanctum.",
    category: "construction",
    details: "The temple received a magnificent copper shikhara.",
  },
  {
    id: "e12",
    year: "1975",
    title: "Silver Rathotsavam",
    description: "Introduction of Silver Rathotsavam (chariot festival).",
    category: "festival",
    details: "The grand chariot festival became a major attraction for devotees.",
  },
  {
    id: "e13",
    year: "1990",
    title: "Modern Audio System",
    description: "Introduction of public address system for bhajans and discourses.",
    category: "event",
    details: "Technology integration began to enhance devotional experience.",
  },
  {
    id: "e14",
    year: "2000",
    title: "Website Launch",
    description: "Temple launched its official website for devotees worldwide.",
    category: "event",
    details: "Bringing the temple's spiritual wealth to the digital world.",
  },
  {
    id: "e15",
    year: "2010",
    title: "Live Darshan Started",
    description: "Introduction of live streaming of daily rituals.",
    category: "event",
    details: "Devotees worldwide can now participate in temple activities virtually.",
  },
  {
    id: "e16",
    year: "2015",
    title: "Digital Library",
    description: "Online repository of scriptures, stotras, and spiritual literature.",
    category: "event",
    details: "Making sacred knowledge accessible to all through technology.",
  },
  {
    id: "e17",
    year: "2020",
    title: "Online Seva Booking",
    description: "Digital platform for booking sevas and donations.",
    category: "event",
    details: "Modern convenience for devotees to participate in temple services.",
  },
  {
    id: "e18",
    year: "2025",
    title: "Temple Platform v2.0",
    description: "Launch of comprehensive digital platform with AI assistant.",
    category: "event",
    details: "A new era of spiritual engagement through technology.",
  },
];

const CATEGORIES = [
  { id: "all", label: "All", icon: Clock, color: "text-stone-600" },
  { id: "history", label: "History", icon: History, color: "text-amber-600" },
  { id: "guru", label: "Guru Parampara", icon: Users, color: "text-purple-600" },
  { id: "construction", label: "Construction", icon: Construction, color: "text-blue-600" },
  { id: "festival", label: "Festivals", icon: Sparkles, color: "text-orange-600" },
  { id: "event", label: "Events", icon: Calendar, color: "text-green-600" },
];

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>(TIMELINE_EVENTS);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  const filteredEvents = selectedCategory === "all"
    ? events
    : events.filter((e) => e.category === selectedCategory);

  // Group events by decade
  const groupedEvents = filteredEvents.reduce((acc, event) => {
    const decade = Math.floor(parseInt(event.year) / 100) * 100;
    const key = `${decade}s`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  const sortedDecades = Object.keys(groupedEvents).sort((a, b) => 
    parseInt(b) - parseInt(a)
  );

  function getCategoryStyle(category: TimelineEvent["category"]) {
    const styles: Record<string, { bg: string; text: string; border: string }> = {
      history: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
      guru: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300" },
      construction: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
      festival: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" },
      event: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
    };
    return styles[category] || styles.event;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-700 to-red-700 py-16">
        <div className="absolute inset-0 bg-[url('/images/p pattern.svg')] opacity-10" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <History className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Temple Timeline</h1>
          <p className="mt-2 text-orange-100">
            Journey through the sacred history of Sri Raghavendra Swamy Matha
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Category Filter */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  selectedCategory === cat.id
                    ? `${cat.color} bg-white ring-2 ring-current`
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className="relative">
          {/* Center Line */}
          <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-gradient-to-b from-amber-300 via-orange-300 to-red-300 hidden md:block" />

          {/* Events */}
          <div className="space-y-8">
            {sortedDecades.map((decade) => (
              <div key={decade}>
                {/* Decade Marker */}
                <div className="relative mb-6 text-center">
                  <span className="inline-block rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-2 text-lg font-bold text-white shadow-lg">
                    {decade}
                  </span>
                </div>

                <div className="space-y-6">
                  {groupedEvents[decade].map((event, index) => {
                    const isLeft = parseInt(event.year) % 2 === 0;
                    const style = getCategoryStyle(event.category);
                    const isExpanded = expandedEvent === event.id;

                    return (
                      <div
                        key={event.id}
                        className={`relative flex flex-col gap-4 md:flex-row ${
                          isLeft ? "md:flex-row" : "md:flex-row-reverse"
                        }`}
                      >
                        {/* Timeline Dot */}
                        <div className="absolute left-1/2 top-8 z-10 hidden h-4 w-4 -translate-x-1/2 rounded-full border-2 border-amber-500 bg-white md:block" />

                        {/* Content Card */}
                        <div
                          className={`flex-1 ${
                            isLeft ? "md:text-right md:pr-8" : "md:pl-8"
                          }`}
                        >
                          <div
                            className={`group cursor-pointer overflow-hidden rounded-2xl border ${style.border} bg-white p-6 shadow-sm transition-all hover:shadow-lg ${
                              isLeft ? "md:ml-auto md:max-w-md" : "md:mr-auto md:max-w-md"
                            }`}
                            onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className={`flex items-center gap-2 ${isLeft ? "md:flex-row-reverse" : ""}`}>
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${style.bg}`}>
                                  {event.category === "history" && <History className={`h-5 w-5 ${style.text}`} />}
                                  {event.category === "guru" && <Users className={`h-5 w-5 ${style.text}`} />}
                                  {event.category === "construction" && <Construction className={`h-5 w-5 ${style.text}`} />}
                                  {event.category === "festival" && <Sparkles className={`h-5 w-5 ${style.text}`} />}
                                  {event.category === "event" && <Calendar className={`h-5 w-5 ${style.text}`} />}
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                                  {event.year}
                                </span>
                              </div>
                              <button className="shrink-0 p-1 text-stone-400 hover:text-stone-600">
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5" />
                                ) : (
                                  <ChevronDown className="h-5 w-5" />
                                )}
                              </button>
                            </div>

                            <h3 className="mt-3 text-lg font-semibold text-stone-900">
                              {event.title}
                            </h3>
                            <p className={`mt-2 text-sm text-stone-600 ${isLeft ? "md:text-right" : ""}`}>
                              {event.description}
                            </p>

                            {/* Expanded Details */}
                            {isExpanded && event.details && (
                              <div className={`mt-4 rounded-lg bg-stone-50 p-4 ${isLeft ? "md:text-right" : ""}`}>
                                <p className="text-sm text-stone-600">
                                  {event.details}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Spacer for alternating layout */}
                        <div className="hidden w-1/2 md:block" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Journey CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-8 text-center text-white">
          <Landmark className="mx-auto h-12 w-12 opacity-80" />
          <h2 className="mt-4 text-2xl font-bold">Continue the Sacred Journey</h2>
          <p className="mt-2 text-orange-100">
            Explore more about Sri Raghavendra Swamy and our temple traditions.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href="/guruparampara"
              className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/30"
            >
              Guru Parampara
            </a>
            <a
              href="/knowledge"
              className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/30"
            >
              Knowledge Center
            </a>
            <a
              href="/shlokas"
              className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/30"
            >
              Sacred Texts
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
