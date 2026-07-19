"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Breadcrumb from "@/components/calendar/Breadcrumb";
import SectionHeading from "@/components/common/SectionHeading";
import {
  Clock,
  MapPin,
  Shirt,
  Car,
  Users,
  Calendar,
  Compass,
  Sunrise,
  BookOpen,
  Image as ImageIcon,
  Heart,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface JourneyPhase {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
  items: JourneyItem[];
}

interface JourneyItem {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

export default function JourneyPage() {
  const phases: JourneyPhase[] = [
    {
      id: "before",
      title: "Before Your Visit",
      subtitle: "Prepare for a meaningful darshan",
      icon: <Sunrise className="h-8 w-8" />,
      color: "text-orange-600",
      bgGradient: "from-orange-50 to-amber-50",
      items: [
        {
          title: "Temple Timings",
          description: "Know the opening hours and special pooja schedules",
          href: "/pooja",
          icon: <Clock className="h-5 w-5" />,
        },
        {
          title: "Location & Directions",
          description: "Find us in Yelahanka, Bengaluru with easy navigation",
          href: "/facilities",
          icon: <MapPin className="h-5 w-5" />,
        },
        {
          title: "Dress Code",
          description: "Traditional attire guidelines for devotees",
          href: "/knowledge/article/dress-code",
          icon: <Shirt className="h-5 w-5" />,
        },
        {
          title: "Facilities",
          description: "Wheelchair access, parking, and amenities available",
          href: "/facilities",
          icon: <Car className="h-5 w-5" />,
        },
        {
          title: "Visitor Guidelines",
          description: "Etiquette and norms to follow during your visit",
          href: "/knowledge/article/visitor-guidelines",
          icon: <Users className="h-5 w-5" />,
        },
      ],
    },
    {
      id: "during",
      title: "During Your Visit",
      subtitle: "Experience the divine atmosphere",
      icon: <Compass className="h-8 w-8" />,
      color: "text-amber-600",
      bgGradient: "from-amber-50 to-orange-50",
      items: [
        {
          title: "Temple Explorer",
          description: "Interactive map of the temple complex",
          href: "/temple-explorer",
          icon: <MapPin className="h-5 w-5" />,
        },
        {
          title: "Today's Pooja Schedule",
          description: "Current and upcoming poojas at the temple",
          href: "/pooja",
          icon: <Calendar className="h-5 w-5" />,
        },
        {
          title: "Today's Schedule",
          description: "Daily poojas and special sevas happening today",
          href: "/events",
          icon: <Calendar className="h-5 w-5" />,
        },
        {
          title: "Festival Information",
          description: "Learn about upcoming festivals and celebrations",
          href: "/calendar/festivals",
          icon: <Sparkles className="h-5 w-5" />,
        },
        {
          title: "Available Sevas",
          description: "Book special services and offerings",
          href: "/sevas",
          icon: <Heart className="h-5 w-5" />,
        },
      ],
    },
    {
      id: "after",
      title: "After Your Visit",
      subtitle: "Continue your spiritual connection",
      icon: <BookOpen className="h-8 w-8" />,
      color: "text-emerald-600",
      bgGradient: "from-emerald-50 to-teal-50",
      items: [
        {
          title: "About Sri Raghavendra Swamy",
          description: "Learn about the saint and his divine leela",
          href: "/knowledge/category/history",
          icon: <BookOpen className="h-5 w-5" />,
        },
        {
          title: "Guru Parampara",
          description: "Explore the lineage of pontiffs",
          href: "/guruparampara",
          icon: <Users className="h-5 w-5" />,
        },
        {
          title: "Knowledge Centre",
          description: "Articles on philosophy, rituals, and traditions",
          href: "/knowledge",
          icon: <BookOpen className="h-5 w-5" />,
        },
        {
          title: "Gallery",
          description: "View photos and videos from temple events",
          href: "/gallery",
          icon: <ImageIcon className="h-5 w-5" />,
        },
      ],
    },
  ];

  const keyBenefits = [
    { text: "Plan your visit with accurate timings and directions" },
    { text: "Navigate the temple complex with our interactive explorer" },
    { text: "Learn about the history and philosophy" },
    { text: "Connect with the community through sevas and donations" },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-120px)] bg-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 py-20">
          <div className="absolute inset-0 opacity-10">
            <Image
              src="/images/Hero.jpg"
              alt="Temple"
              fill
              className="object-cover"
            />
          </div>

          <div className="relative mx-auto max-w-7xl px-6">
            <Breadcrumb current="Devotee Journey" />
            <div className="text-center mt-8">
              <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
                Your Devotee Journey
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-xl text-amber-100">
                A complete guide connecting you with the divine experience at
                Sri Raghavendra Swamy Matha. From planning your visit to
                continuing your spiritual journey at home.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="#before"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-amber-700 hover:bg-amber-50 transition-colors font-medium"
                >
                  <Sunrise className="h-5 w-5" />
                  Before Visit
                </Link>
                <Link
                  href="#during"
                  className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-6 py-3 text-white hover:bg-amber-500 transition-colors font-medium"
                >
                  <Compass className="h-5 w-5" />
                  During Visit
                </Link>
                <Link
                  href="#after"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-white hover:bg-emerald-500 transition-colors font-medium"
                >
                  <BookOpen className="h-5 w-5" />
                  After Visit
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Key Benefits */}
        <section className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-12 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {keyBenefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm"
                >
                  <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald-600" />
                  <span className="text-stone-700">{benefit.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Journey Phases */}
        {phases.map((phase) => (
          <section
            key={phase.id}
            id={phase.id}
            className={`bg-gradient-to-br ${phase.bgGradient} px-6 py-20 sm:px-8 lg:px-12`}
          >
            <div className="mx-auto max-w-7xl">
              {/* Phase Header */}
              <div className="mb-12 text-center">
                <div
                  className={`inline-flex rounded-full ${phase.color} mb-4`}
                >
                  {phase.icon}
                </div>
                <h2 className="text-3xl font-bold text-stone-900 md:text-4xl">
                  {phase.title}
                </h2>
                <p className="mt-4 text-lg text-stone-600">
                  {phase.subtitle}
                </p>
              </div>

              {/* Phase Items */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {phase.items.map((item, index) => (
                  <Link
                    key={index}
                    href={item.href}
                    className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${phase.color.replace(
                          "text-",
                          "from-"
                        )} bg-opacity-10 ${phase.color}`}
                      >
                        {item.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-stone-900 group-hover:text-amber-600 transition-colors">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm text-stone-500">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 flex-shrink-0 text-stone-300 transition-transform group-hover:translate-x-1 group-hover:text-amber-600" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* AI Assistant CTA */}
        <section className="bg-gradient-to-br from-amber-700 via-orange-600 to-amber-900 px-6 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Have Questions?
            </h2>
            <p className="mt-4 text-xl text-amber-100">
              Our AI assistant Raya is here to help you with any questions about
              temple timings, sevas, festivals, and more.
            </p>
            <Link
              href="/ai/chat"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <Sparkles className="h-6 w-6" />
              Chat with Raya AI
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {/* Donate CTA */}
        <section className="px-6 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl">
            <SectionHeading
              title="Support Our Mission"
              subtitle="Your generous contributions help maintain the temple, conduct festivals, and serve the community"
            />
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/donation"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-8 py-4 text-lg font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <Heart className="h-6 w-6" />
                Make a Donation
              </Link>
              <Link
                href="/sevas"
                className="inline-flex items-center gap-2 rounded-full border-2 border-stone-300 px-8 py-4 text-lg font-semibold text-stone-700 hover:border-amber-600 hover:text-amber-600 transition-colors"
              >
                <Heart className="h-6 w-6" />
                Book a Seva
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
