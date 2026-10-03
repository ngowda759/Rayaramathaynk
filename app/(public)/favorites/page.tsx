"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useProfile } from "@/context/ProfileContext";
import { useAuthContext } from "@/context/AuthContext";
import { eventService } from "@/services/event.service";
import { quoteService } from "@/services/quote.service";
import { galleryService } from "@/services/gallery.service";
import { knowledgeService } from "@/services/knowledge.service";
import { CardSkeleton } from "@/components/common/SkeletonLoader";
import {
  Heart,
  Calendar,
  BookOpen,
  Image as ImageIcon,
  Quote as QuoteIcon,
  Video,
  Music,
  Filter,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";

type FavoriteType = "event" | "article" | "gallery" | "quote" | "stotra" | "video" | "audio" | "book";

interface FavoriteItem {
  id: string;
  type: FavoriteType;
  itemId: string;
  title: string;
  description?: string;
  thumbnail?: string;
  url: string;
  addedAt: Date;
}

const TYPE_CONFIG: Record<FavoriteType, { icon: typeof Heart; label: string; color: string }> = {
  event: { icon: Calendar, label: "Events", color: "bg-blue-100 text-blue-600" },
  article: { icon: BookOpen, label: "Articles", color: "bg-purple-100 text-purple-600" },
  gallery: { icon: ImageIcon, label: "Gallery", color: "bg-green-100 text-green-600" },
  quote: { icon: QuoteIcon, label: "Quotes", color: "bg-amber-100 text-amber-600" },
  stotra: { icon: Music, label: "Stotras", color: "bg-orange-100 text-orange-600" },
  video: { icon: Video, label: "Videos", color: "bg-red-100 text-red-600" },
  audio: { icon: Music, label: "Audio", color: "bg-cyan-100 text-cyan-600" },
  book: { icon: BookOpen, label: "Books", color: "bg-indigo-100 text-indigo-600" },
};

const ALL_TYPES: FavoriteType[] = ["event", "article", "gallery", "quote", "stotra", "video", "audio", "book"];

export default function FavoritesPage() {
  const { user } = useAuthContext();
  const { profile, isLoading: profileLoading, getBookmarks } = useProfile();

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FavoriteType | "all">("all");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    loadFavorites();
  }, [profile]);

  async function loadFavorites() {
    if (!profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const bookmarks = await getBookmarks();
      const items: FavoriteItem[] = [];

      for (const bookmark of bookmarks) {
        items.push({
          id: bookmark.id,
          type: bookmark.type,
          itemId: bookmark.itemId,
          title: bookmark.title,
          description: bookmark.description,
          thumbnail: bookmark.thumbnail,
          url: bookmark.url,
          addedAt: new Date(bookmark.createdAt),
        });
      }

      setFavorites(items);
    } catch (error) {
      console.error("[FavoritesPage] Error loading favorites:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredFavorites = filter === "all"
    ? favorites
    : favorites.filter((f) => f.type === filter);

  const favoritesByType = ALL_TYPES.reduce((acc, type) => {
    acc[type] = favorites.filter((f) => f.type === type).length;
    return acc;
  }, {} as Record<FavoriteType, number>);

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Heart className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-stone-900">
              Sign in to view your favorites
            </h1>
            <p className="mb-6 text-stone-600">
              Create an account or sign in to save your favorite content.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-6 py-3 font-semibold text-stone-700"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900">My Favorites</h1>
          <p className="mt-2 text-stone-600">
            {favorites.length === 0
              ? "You haven't saved any favorites yet"
              : `You have ${favorites.length} saved favorite${favorites.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 pb-2" role="tablist">
            <button
              onClick={() => setFilter("all")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                filter === "all"
                  ? "bg-amber-100 text-amber-800 ring-2 ring-amber-500"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
              }`}
              role="tab"
              aria-selected={filter === "all"}
            >
              <Heart className="h-4 w-4" />
              All ({favorites.length})
            </button>
            {ALL_TYPES.map((type) => {
              const config = TYPE_CONFIG[type];
              const Icon = config.icon;
              const count = favoritesByType[type];
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                    filter === type
                      ? "bg-amber-100 text-amber-800 ring-2 ring-amber-500"
                      : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
                  }`}
                  role="tab"
                  aria-selected={filter === type}
                >
                  <Icon className="h-4 w-4" />
                  {config.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {loading || profileLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center">
            <Heart className="mx-auto h-12 w-12 text-stone-300" />
            <h2 className="mt-4 text-lg font-semibold text-stone-900">
              {filter === "all" ? "No favorites yet" : `No ${TYPE_CONFIG[filter].label.toLowerCase()} favorites`}
            </h2>
            <p className="mt-2 text-stone-600">
              {filter === "all"
                ? "Start exploring and save content you love!"
                : `You haven't saved any ${TYPE_CONFIG[filter].label.toLowerCase()} yet`}
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white"
            >
              Explore Content
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFavorites.map((favorite) => {
              const config = TYPE_CONFIG[favorite.type];
              const Icon = config.icon;

              return (
                <div
                  key={favorite.id}
                  className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:shadow-lg"
                >
                  {favorite.thumbnail && (
                    <div className="relative h-48 overflow-hidden bg-stone-100">
                      <Image
                        src={favorite.thumbnail}
                        alt={favorite.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                      <div className={`absolute left-4 top-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    {!favorite.thumbnail && (
                      <div className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </div>
                    )}
                    <h3 className="font-semibold text-stone-900 line-clamp-2">
                      {favorite.title}
                    </h3>
                    {favorite.description && (
                      <p className="mt-1 text-sm text-stone-600 line-clamp-2">
                        {favorite.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        href={favorite.url}
                        className="text-sm font-medium text-amber-600 hover:text-amber-700"
                      >
                        View Details
                      </Link>
                      <span className="text-xs text-stone-400">
                        {favorite.addedAt.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
