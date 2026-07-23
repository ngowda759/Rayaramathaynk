"use client";

import { useState } from "react";
import { useProfile } from "@/context/ProfileContext";
import { useAuthContext } from "@/context/AuthContext";
import { Heart, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface FavoriteButtonProps {
  itemId: string;
  type: "event" | "article" | "gallery" | "quote" | "stotra" | "video" | "audio" | "book";
  title: string;
  description?: string;
  thumbnail?: string;
  url: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function FavoriteButton({
  itemId,
  type,
  title,
  description,
  thumbnail,
  url,
  size = "md",
  showLabel = false,
  className = "",
}: FavoriteButtonProps) {
  const { user } = useAuthContext();
  const { isFavorited, addBookmark, removeBookmark, getBookmarks } = useProfile();
  const [loading, setLoading] = useState(false);

  const isFav = isFavorited(itemId);

  const sizeClasses = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-3",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error("Please sign in to save favorites");
      return;
    }

    setLoading(true);
    try {
      if (isFav) {
        // Find and remove the bookmark
        const bookmarks = await getBookmarks(type);
        const bookmark = bookmarks.find((b: any) => b.itemId === itemId);
        if (bookmark) {
          await removeBookmark(bookmark.id);
        }
        toast.success("Removed from favorites");
      } else {
        await addBookmark({
          type,
          itemId,
          title,
          description,
          thumbnail,
          url,
        });
        toast.success("Added to favorites");
      }
    } catch (error) {
      console.error("[FavoriteButton] Error toggling favorite:", error);
      toast.error("Failed to update favorites");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`
        flex items-center gap-2 rounded-lg font-medium transition-all
        ${isFav
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900"
        }
        ${sizeClasses[size]}
        ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFav}
    >
      {loading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <Heart
          className={`${iconSizes[size]} ${isFav ? "fill-current" : ""}`}
        />
      )}
      {showLabel && (
        <span className="text-sm">
          {isFav ? "Saved" : "Save"}
        </span>
      )}
    </button>
  );
}

/**
 * Compact favorite button for inline use (just heart icon)
 */
export function FavoriteIcon({
  itemId,
  type,
  title,
  description,
  thumbnail,
  url,
  className = "",
}: Omit<FavoriteButtonProps, "size" | "showLabel">) {
  return (
    <FavoriteButton
      itemId={itemId}
      type={type}
      title={title}
      description={description}
      thumbnail={thumbnail}
      url={url}
      size="sm"
      className={className}
    />
  );
}
