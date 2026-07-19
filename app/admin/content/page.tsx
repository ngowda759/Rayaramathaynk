"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { 
  BookOpen, Image, CalendarDays, Users, 
  MessageSquare, FileText, Settings, 
  PlusCircle, ChevronRight, Eye,
  CheckCircle2, Clock, AlertCircle,
  Layers, Search, Filter, RefreshCw,
  Star, PenTool, FolderOpen
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getCountFromServer, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

interface ContentStats {
  events: number;
  upcomingEvents: number;
  announcements: number;
  activeAnnouncements: number;
  gallery: number;
  sevas: number;
  poojas: number;
  knowledgeArticles: number;
  testimonials: number;
  pendingTestimonials: number;
  volunteers: number;
  pendingVolunteers: number;
}

interface RecentItem {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt: string;
  href: string;
}

interface DraftItem {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
  href: string;
}

export default function ContentDashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<ContentStats>({
    events: 0,
    upcomingEvents: 0,
    announcements: 0,
    activeAnnouncements: 0,
    gallery: 0,
    sevas: 0,
    poojas: 0,
    knowledgeArticles: 0,
    testimonials: 0,
    pendingTestimonials: 0,
    volunteers: 0,
    pendingVolunteers: 0,
  });
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContentStats() {
      if (!db) { setLoading(false); return; }
      
      try {
        const now = new Date();
        
        const [
          eventsSnap,
          upcomingSnap,
          announcementsSnap,
          activeAnnouncementsSnap,
          gallerySnap,
          sevasSnap,
          poojasSnap,
          knowledgeSnap,
          testimonialsSnap,
          pendingTestimonialsSnap,
          volunteersSnap,
        ] = await Promise.all([
          getCountFromServer(collection(db, "events")),
          getCountFromServer(query(collection(db, "events"), where("date", ">=", now.toISOString()))),
          getCountFromServer(collection(db, "announcements")),
          getCountFromServer(query(collection(db, "announcements"), where("active", "==", true))),
          getCountFromServer(collection(db, "gallery")),
          getCountFromServer(collection(db, "sevas")),
          getCountFromServer(collection(db, "poojas")),
          getCountFromServer(collection(db, "knowledge")),
          getCountFromServer(collection(db, "testimonials")),
          getCountFromServer(query(collection(db, "testimonials"), where("approved", "==", false))),
          getCountFromServer(collection(db, "volunteer_requests")),
        ]);

        setStats({
          events: eventsSnap.data().count,
          upcomingEvents: upcomingSnap.data().count,
          announcements: announcementsSnap.data().count,
          activeAnnouncements: activeAnnouncementsSnap.data().count,
          gallery: gallerySnap.data().count,
          sevas: sevasSnap.data().count,
          poojas: poojasSnap.data().count,
          knowledgeArticles: knowledgeSnap.data().count,
          testimonials: testimonialsSnap.data().count,
          pendingTestimonials: pendingTestimonialsSnap.data().count,
          volunteers: volunteersSnap.data().count,
          pendingVolunteers: 0, // Need to query for pending status
        });

        // Fetch recent items
        const recentPromises = [
          getDocs(query(collection(db, "events"), orderBy("updatedAt", "desc"), limit(3))),
          getDocs(query(collection(db, "announcements"), orderBy("updatedAt", "desc"), limit(3))),
          getDocs(query(collection(db, "knowledge"), orderBy("updatedAt", "desc"), limit(3))),
        ];

        const [recentEvents, recentAnnouncements, recentKnowledge] = await Promise.all(recentPromises);
        
        const items: RecentItem[] = [];
        
        recentEvents.docs.forEach(doc => {
          const data = doc.data();
          items.push({
            id: doc.id,
            title: data.title || "Untitled Event",
            type: "Event",
            status: data.active ? "Active" : "Draft",
            updatedAt: data.updatedAt?.toDate?.()?.toLocaleDateString() || "Unknown",
            href: `/admin/events/${doc.id}/edit`,
          });
        });
        
        recentAnnouncements.docs.forEach(doc => {
          const data = doc.data();
          items.push({
            id: doc.id,
            title: data.title || "Untitled",
            type: "Announcement",
            status: data.active ? "Active" : "Draft",
            updatedAt: data.updatedAt?.toDate?.()?.toLocaleDateString() || "Unknown",
            href: `/admin/announcements/${doc.id}/edit`,
          });
        });
        
        recentKnowledge.docs.forEach(doc => {
          const data = doc.data();
          items.push({
            id: doc.id,
            title: data.title?.en || "Untitled",
            type: "Article",
            status: data.status || "Draft",
            updatedAt: data.updatedAt?.toDate?.()?.toLocaleDateString() || "Unknown",
            href: `/admin/knowledge/${doc.id}/edit`,
          });
        });

        setRecentItems(items.slice(0, 6));

        // Fetch draft content
        const draftPromises = [
          getDocs(query(collection(db, "events"), where("active", "==", false), limit(3))),
          getDocs(query(collection(db, "announcements"), where("active", "==", false), limit(3))),
        ];

        const [draftEvents, draftAnnouncements] = await Promise.all(draftPromises);
        
        const draftItems: DraftItem[] = [];
        
        draftEvents.docs.forEach(doc => {
          const data = doc.data();
          draftItems.push({
            id: doc.id,
            title: data.title || "Untitled Event",
            type: "Event",
            updatedAt: data.updatedAt?.toDate?.()?.toLocaleDateString() || "Unknown",
            href: `/admin/events/${doc.id}/edit`,
          });
        });
        
        draftAnnouncements.docs.forEach(doc => {
          const data = doc.data();
          draftItems.push({
            id: doc.id,
            title: data.title || "Untitled Announcement",
            type: "Announcement",
            updatedAt: data.updatedAt?.toDate?.()?.toLocaleDateString() || "Unknown",
            href: `/admin/announcements/${doc.id}/edit`,
          });
        });

        setDrafts(draftItems);
      } catch (error) {
        console.error("Error fetching content stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchContentStats();
  }, []);

  const contentCards = [
    {
      title: "Events",
      count: stats.events,
      icon: CalendarDays,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      href: "/admin/events",
      addHref: "/admin/events/new",
    },
    {
      title: "Announcements",
      count: stats.activeAnnouncements,
      subtitle: `of ${stats.announcements} total`,
      icon: MessageSquare,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      href: "/admin/announcements",
      addHref: "/admin/announcements/new",
    },
    {
      title: "Gallery",
      count: stats.gallery,
      icon: Image,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      href: "/admin/gallery",
      addHref: "/admin/gallery/new",
    },
    {
      title: "Sevas",
      count: stats.sevas,
      icon: Layers,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      href: "/admin/sevas",
      addHref: "/admin/sevas/new",
    },
    {
      title: "Poojas",
      count: stats.poojas,
      icon: BookOpen,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      href: "/admin/pooja",
      addHref: "/admin/pooja/create",
    },
    {
      title: "Knowledge",
      count: stats.knowledgeArticles,
      icon: FileText,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      href: "/admin/knowledge",
      addHref: "/admin/knowledge/new",
    },
  ];

  const pendingItems = [
    ...(stats.pendingTestimonials > 0 ? [{ 
      count: stats.pendingTestimonials, 
      type: "Testimonials", 
      icon: Users, 
      href: "/admin/testimonials",
      color: "text-amber-600"
    }] : []),
    ...(stats.pendingVolunteers > 0 ? [{
      count: stats.pendingVolunteers,
      type: "Volunteer Requests",
      icon: Users,
      href: "/admin/ai/volunteers",
      color: "text-blue-600"
    }] : []),
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900">Content Dashboard</h1>
          <p className="mt-2 text-stone-600">
            Manage all your content in one place
          </p>
        </div>

        {/* Pending Reviews Alert */}
        {pendingItems.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                Pending Reviews:
              </span>
              <div className="flex gap-3">
                {pendingItems.map((item, index) => (
                  <Link
                    key={index}
                    href={item.href}
                    className="flex items-center gap-1 text-amber-700 hover:text-amber-900"
                  >
                    {item.count} {item.type}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content Cards Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {contentCards.map((card) => (
            <div
              key={card.title}
              className="group relative overflow-hidden rounded-xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className={`${card.bgColor} rounded-lg p-3`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
                <Link
                  href={card.addHref}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 opacity-0 transition-opacity hover:bg-amber-200 group-hover:opacity-100"
                >
                  <PlusCircle className="h-4 w-4" />
                </Link>
              </div>
              
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-stone-900">
                  {card.count}
                </h3>
                <p className="text-sm font-medium text-stone-700">{card.title}</p>
                {card.subtitle && (
                  <p className="text-xs text-stone-500">{card.subtitle}</p>
                )}
              </div>
              
              <Link
                href={card.href}
                className="mt-4 flex items-center gap-1 text-sm font-medium text-amber-600 opacity-0 transition-opacity group-hover:opacity-100"
              >
                Manage {card.title}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Content */}
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-stone-400" />
                Recent Content
              </h2>
              <button className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
            
            <div className="space-y-3">
              {recentItems.length > 0 ? (
                recentItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg border border-stone-100 p-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full px-2 py-1 text-xs font-medium ${
                        item.type === "Event" ? "bg-blue-100 text-blue-700" :
                        item.type === "Announcement" ? "bg-amber-100 text-amber-700" :
                        "bg-indigo-100 text-indigo-700"
                      }`}>
                        {item.type}
                      </div>
                      <div>
                        <p className="font-medium text-stone-700">{item.title}</p>
                        <p className="text-xs text-stone-500">{item.updatedAt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        item.status === "Active" ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-600"
                      }`}>
                        {item.status}
                      </span>
                      <ChevronRight className="h-4 w-4 text-stone-400" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center text-stone-500">
                  <FileText className="mx-auto h-8 w-8 text-stone-300" />
                  <p className="mt-2">No recent content</p>
                </div>
              )}
            </div>
          </div>

          {/* Draft Content */}
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-stone-400" />
                Draft Content
              </h2>
              <Link
                href="/admin/events"
                className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
              >
                View All
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="space-y-3">
              {drafts.length > 0 ? (
                drafts.map((draft) => (
                  <Link
                    key={draft.id}
                    href={draft.href}
                    className="flex items-center justify-between rounded-lg border border-stone-100 p-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">
                        {draft.type}
                      </div>
                      <div>
                        <p className="font-medium text-stone-700">{draft.title}</p>
                        <p className="text-xs text-stone-500">Updated {draft.updatedAt}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-400" />
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-green-400" />
                  <p className="mt-2 text-sm text-stone-500">No drafts pending</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-stone-900 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-stone-400" />
            Quick Actions
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Add Event", href: "/admin/events/new", icon: CalendarDays },
              { label: "New Announcement", href: "/admin/announcements/new", icon: MessageSquare },
              { label: "Upload to Gallery", href: "/admin/gallery/new", icon: Image },
              { label: "Knowledge Article", href: "/admin/knowledge", icon: FileText },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-200 p-4 text-stone-600 transition-colors hover:border-amber-400 hover:text-amber-600"
              >
                <action.icon className="h-5 w-5" />
                <span className="font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Navigation Links */}
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/media"
            className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <div className="rounded-lg bg-blue-100 p-3">
              <FolderOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">Media Library</p>
              <p className="text-sm text-stone-500">Central media storage</p>
            </div>
            <ChevronRight className="ml-auto h-5 w-5 text-stone-400" />
          </Link>
          
          <Link
            href="/admin/featured"
            className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <div className="rounded-lg bg-amber-100 p-3">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">Featured Content</p>
              <p className="text-sm text-stone-500">Manage highlighted items</p>
            </div>
            <ChevronRight className="ml-auto h-5 w-5 text-stone-400" />
          </Link>
          
          <Link
            href="/admin/settings"
            className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <div className="rounded-lg bg-stone-100 p-3">
              <Settings className="h-6 w-6 text-stone-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">Settings</p>
              <p className="text-sm text-stone-500">Configure temple settings</p>
            </div>
            <ChevronRight className="ml-auto h-5 w-5 text-stone-400" />
          </Link>
          
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <div className="rounded-lg bg-purple-100 p-3">
              <Eye className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900">View Website</p>
              <p className="text-sm text-stone-500">Open public site</p>
            </div>
            <ChevronRight className="ml-auto h-5 w-5 text-stone-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}
