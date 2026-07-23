"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useProfile } from "@/context/ProfileContext";
import { useAuthContext } from "@/context/AuthContext";
import { eventService } from "@/services/event.service";
import { quoteService } from "@/services/quote.service";
import { knowledgeService } from "@/services/knowledge.service";
import {
  Calendar,
  Quote as QuoteIcon,
  BookOpen,
  Clock,
  ChevronRight,
  Sparkles,
  Heart,
  Eye,
  ArrowRight,
} from "lucide-react";

interface PersonalizedSection {
  id: string;
  title: string;
  icon: typeof Sparkles;
  items: PersonalizedItem[];
}

interface PersonalizedItem {
  id: string;
  type: "event" | "quote" | "article";
  title: string;
  subtitle?: string;
  thumbnail?: string;
  url: string;
  date?: string;
}

export function PersonalizedHomepage({ children }: { children?: React.ReactNode }) {
  const { user } = useAuthContext();
  const { profile, isLoading: profileLoading, getBookmarks } = useProfile();

  const [sections, setSections] = useState<PersonalizedSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile) {
      loadPersonalizedContent();
    } else {
      setLoading(false);
    }
  }, [user, profile]);

  async function loadPersonalizedContent() {
    setLoading(true);
    const newSections: PersonalizedSection[] = [];

    try {
      // Today's Reminder (always show if notifications enabled)
      if (profile?.preferences?.notifications?.aaradhane) {
        newSections.push({
          id: "reminder",
          title: "Today's Reminder",
          icon: Sparkles,
          items: [
            {
              id: "aaradhane-reminder",
              type: "event",
              title: "Daily Aaradhane",
              subtitle: "Join the daily spiritual practice",
              url: "/aaradhane",
              thumbnail: "/images/aaradhane.jpg",
            },
          ],
        });
      }

      // Saved Bookmarks
      try {
        const bookmarks = await getBookmarks();
        
        // Group bookmarks by type
        const eventBookmarks = bookmarks.filter((b: any) => b.type === "event").slice(0, 3);
        const quoteBookmarks = bookmarks.filter((b: any) => b.type === "quote").slice(0, 3);
        const articleBookmarks = bookmarks.filter((b: any) => b.type === "article").slice(0, 3);

        if (eventBookmarks.length > 0) {
          newSections.push({
            id: "saved-events",
            title: "Your Saved Events",
            icon: Heart,
            items: eventBookmarks.map((b: any) => ({
              id: b.id,
              type: "event" as const,
              title: b.title,
              subtitle: b.description,
              thumbnail: b.thumbnail,
              url: b.url,
            })),
          });
        }

        if (quoteBookmarks.length > 0) {
          newSections.push({
            id: "favorite-quotes",
            title: "Your Favorite Quotes",
            icon: QuoteIcon,
            items: quoteBookmarks.map((b: any) => ({
              id: b.id,
              type: "quote" as const,
              title: b.title.substring(0, 80) + (b.title.length > 80 ? "..." : ""),
              subtitle: b.description || "Sri Raghavendra Swamy",
              thumbnail: undefined,
              url: b.url,
            })),
          });
        }

        if (articleBookmarks.length > 0) {
          newSections.push({
            id: "continue-reading",
            title: "Continue Reading",
            icon: BookOpen,
            items: articleBookmarks.map((b: any) => ({
              id: b.id,
              type: "article" as const,
              title: b.title,
              subtitle: b.description,
              thumbnail: b.thumbnail,
              url: b.url,
            })),
          });
        }
      } catch (error) {
        console.error("[PersonalizedHomepage] Error loading bookmarks:", error);
      }

      // Suggested Articles (if no bookmarks)
      if (newSections.length === 0) {
        try {
          const articles = await knowledgeService.getRecentArticles();
          const suggested = articles.slice(0, 3).map((a) => ({
            id: a.id,
            type: "article" as const,
            title: a.title,
            subtitle: a.category,
            thumbnail: undefined,
            url: `/knowledge/article/${a.slug}`,
          }));

          if (suggested.length > 0) {
            newSections.push({
              id: "suggested",
              title: "Suggested For You",
              icon: Sparkles,
              items: suggested,
            });
          }
        } catch (error) {
          console.error("[PersonalizedHomepage] Error loading articles:", error);
        }
      }
    } catch (error) {
      console.error("[PersonalizedHomepage] Error loading content:", error);
    } finally {
      setSections(newSections);
      setLoading(false);
    }
  }

  // Not logged in or no content - show default
  if (!user || !profile || (!loading && sections.length === 0)) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Personalized Sections */}
      {loading || profileLoading ? (
        <section className="bg-gradient-to-b from-amber-50 to-white py-8">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 animate-pulse rounded-2xl bg-white shadow" />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-gradient-to-b from-amber-50 to-white py-8">
          <div className="mx-auto max-w-6xl px-6">
            {sections.map((section) => (
              <div key={section.id} className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <section.icon className="h-5 w-5 text-amber-600" />
                    <h2 className="text-lg font-semibold text-stone-900">
                      {section.title}
                    </h2>
                  </div>
                  <Link
                    href={
                      section.id === "saved-events"
                        ? "/favorites?filter=event"
                        : section.id === "favorite-quotes"
                        ? "/favorites?filter=quote"
                        : section.id === "continue-reading"
                        ? "/knowledge"
                        : "/knowledge"
                    }
                    className="flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
                  >
                    View All
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.url}
                      className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:shadow-lg"
                    >
                      {item.thumbnail && (
                        <div className="relative h-32 overflow-hidden">
                          <Image
                            src={item.thumbnail}
                            alt={item.title}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        {item.type === "quote" && (
                          <div className="mb-2 flex items-center gap-1">
                            <QuoteIcon className="h-4 w-4 text-amber-600" />
                            <span className="text-xs font-medium text-amber-600">
                              Quote
                            </span>
                          </div>
                        )}
                        {item.date && (
                          <div className="mb-1 flex items-center gap-1 text-xs text-stone-500">
                            <Clock className="h-3 w-3" />
                            {new Date(item.date).toLocaleDateString()}
                          </div>
                        )}
                        <h3 className="font-semibold text-stone-900 line-clamp-2">
                          {item.title}
                        </h3>
                        {item.subtitle && (
                          <p className="mt-1 text-sm text-stone-500">
                            {item.subtitle}
                          </p>
                        )}
                        <div className="mt-3 flex items-center text-sm font-medium text-amber-600">
                          Read More
                          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Default Content */}
      {children}
    </>
  );
}

/**
 * Personalized Card Component
 */
export function PersonalizedCard({
  item,
  compact = false,
}: {
  item: PersonalizedItem;
  compact?: boolean;
}) {
  const Icon = item.type === "event" ? Calendar : item.type === "quote" ? QuoteIcon : BookOpen;

  if (compact) {
    return (
      <Link
        href={item.url}
        className="group flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 transition-all hover:border-amber-300 hover:shadow"
      >
        {item.thumbnail && (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
            <Image src={item.thumbnail} alt="" fill className="object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-900">
            {item.title}
          </p>
          {item.subtitle && (
            <p className="truncate text-xs text-stone-500">{item.subtitle}</p>
          )}
        </div>
        <Icon className="h-4 w-4 shrink-0 text-stone-400" />
      </Link>
    );
  }

  return (
    <Link
      href={item.url}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:shadow-lg"
    >
      {item.thumbnail && (
        <div className="relative h-40 overflow-hidden">
          <Image
            src={item.thumbnail}
            alt={item.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-stone-700">
            <Icon className="h-3 w-3" />
            {item.type}
          </div>
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-stone-900 line-clamp-2">{item.title}</h3>
        {item.subtitle && (
          <p className="mt-1 text-sm text-stone-500">{item.subtitle}</p>
        )}
      </div>
    </Link>
  );
}
