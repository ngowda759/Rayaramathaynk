"use client";

import Link from "next/link";
import { 
  Calendar, 
  Image, 
  HeartHandshake, 
  Bell, 
  Users, 
  Clock, 
  Settings,
  Search,
  FileText,
  CreditCard,
  ArrowRight
} from "lucide-react";

interface SearchResult {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  category: string;
}

interface AdminSearchResultsProps {
  query: string;
}

const allPages: SearchResult[] = [
  { title: "Events", description: "Manage temple events and schedules", href: "/admin/events", icon: Calendar, category: "Events" },
  { title: "Create Event", description: "Add a new event", href: "/admin/events/new", icon: Plus, category: "Events" },
  { title: "Gallery", description: "Manage temple gallery and media", href: "/admin/gallery", icon: Image, category: "Gallery" },
  { title: "Upload to Gallery", description: "Upload new images or videos", href: "/admin/gallery/new", icon: Image, category: "Gallery" },
  { title: "Announcements", description: "Create and manage announcements", href: "/admin/announcements", icon: Bell, category: "Announcements" },
  { title: "Create Announcement", description: "Add a new announcement", href: "/admin/announcements/new", icon: Bell, category: "Announcements" },
  { title: "Donations", description: "View and manage donations", href: "/admin/donations", icon: HeartHandshake, category: "Donations" },
  { title: "Users", description: "Manage temple staff and users", href: "/admin/users", icon: Users, category: "Users" },
  { title: "Add User", description: "Create a new user account", href: "/admin/users/new", icon: Users, category: "Users" },
  { title: "Seva Services", description: "Manage temple sevas", href: "/admin/sevas", icon: Clock, category: "Sevas" },
  { title: "Create Seva", description: "Add a new seva service", href: "/admin/sevas/new", icon: Clock, category: "Sevas" },
  { title: "Seva Bookings", description: "View seva bookings", href: "/admin/seva-bookings", icon: Calendar, category: "Sevas" },
  { title: "Bookings", description: "Manage all bookings", href: "/admin/bookings", icon: Calendar, category: "Bookings" },
  { title: "Pooja Services", description: "Manage pooja timings and services", href: "/admin/pooja", icon: Clock, category: "Pooja" },
  { title: "Timings", description: "Manage temple timings", href: "/admin/timings", icon: Clock, category: "Timings" },
  { title: "Reports", description: "View temple reports and analytics", href: "/admin/reports", icon: FileText, category: "Reports" },
  { title: "Settings", description: "Admin settings", href: "/admin/settings", icon: Settings, category: "Settings" },
  { title: "Homepage Settings", description: "Configure homepage content", href: "/admin/settings/homepage", icon: Settings, category: "Settings" },
  { title: "Aaradhane", description: "Manage aaradhane events", href: "/admin/aaradhane", icon: Calendar, category: "Aaradhane" },
  { title: "Create Aaradhane", description: "Add new aaradhane event", href: "/admin/aaradhane/create", icon: Calendar, category: "Aaradhane" },
];

const iconMap: Record<string, React.ElementType> = {
  Calendar,
  Image,
  HeartHandshake,
  Bell,
  Users,
  Clock,
  Settings,
  FileText,
  CreditCard,
};

export default function AdminSearchResults({ query }: AdminSearchResultsProps) {
  const lowerQuery = query.toLowerCase();
  const results = allPages.filter(
    (page) =>
      page.title.toLowerCase().includes(lowerQuery) ||
      page.description.toLowerCase().includes(lowerQuery) ||
      page.category.toLowerCase().includes(lowerQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Search className="h-6 w-6 text-amber-600" />
        <h2 className="text-2xl font-bold">
          Search results for &quot;{query}&quot;
        </h2>
      </div>

      {results.length === 0 ? (
        <div className="rounded-xl border bg-white p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-stone-300" />
          <h3 className="mt-4 text-lg font-semibold text-stone-900">
            No results found
          </h3>
          <p className="mt-2 text-stone-600">
            Try searching for events, gallery, users, donations, or settings
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((result) => {
            const Icon = iconMap[result.category] || Calendar;
            return (
              <Link
                key={result.href}
                href={result.href}
                className="group rounded-xl border bg-white p-6 transition-all hover:border-amber-300 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-stone-900 group-hover:text-amber-700">
                        {result.title}
                      </h3>
                      <ArrowRight className="h-4 w-4 text-stone-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {result.description}
                    </p>
                    <span className="mt-2 inline-block rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600">
                      {result.category}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Plus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14"/>
      <path d="M12 5v14"/>
    </svg>
  );
}
