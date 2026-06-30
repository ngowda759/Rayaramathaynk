"use client";

import { Image, FolderOpen, Star, Video } from "lucide-react";
import { GalleryAlbum, GalleryMedia } from "@/types/gallery";

interface Props {
  albums: GalleryAlbum[];
  media: GalleryMedia[];
}

export default function GalleryStats({
  albums,
  media,
}: Props) {
  const cards = [
    {
      title: "Albums",
      value: albums.length,
      icon: FolderOpen,
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "Media",
      value: media.length,
      icon: Image,
      color: "bg-green-50 text-green-600",
    },
    {
      title: "Featured",
      value: media.filter((m) => m.isFeatured).length,
      icon: Star,
      color: "bg-amber-50 text-amber-600",
    },
    {
      title: "Videos",
      value: media.filter((m) => m.type === "video").length,
      icon: Video,
      color: "bg-purple-50 text-purple-600",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-xl ${card.color}`}
            >
              <Icon size={28} />
            </div>

            <p className="mt-5 text-sm text-stone-500">
              {card.title}
            </p>

            <h3 className="mt-2 text-3xl font-bold">
              {card.value}
            </h3>
          </div>
        );
      })}
    </div>
  );
}
