"use client";

import Image from "next/image";
import { GalleryAlbum, GalleryMedia } from "@/types/gallery";
import { Button } from "@/components/ui/button";
import { Pencil, Star, Trash2, Video } from "lucide-react";

interface Props {
  media: GalleryMedia;
  albums: GalleryAlbum[];
  onEdit: (media: GalleryMedia) => void;
  onDelete: (media: GalleryMedia) => void;
}

export default function MediaCard({
  media,
  albums,
  onEdit,
  onDelete,
}: Props) {
  const album =
    albums.find((a) => a.id === media.albumId)?.title ??
    "Unknown Album";

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-xl">

      <div className="relative h-56 bg-stone-100">

        {media.type === "photo" ? (
          <Image
            src={media.imagePath}
            alt={media.altText}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Video
              size={64}
              className="text-purple-500"
            />
          </div>
        )}

        {media.isFeatured && (
          <div className="absolute right-3 top-3 rounded-full bg-amber-500 p-2 text-white">
            <Star
              size={16}
              fill="white"
            />
          </div>
        )}

      </div>

      <div className="space-y-3 p-5">

        <h3 className="font-bold">
          {media.title}
        </h3>

        <p className="text-sm text-stone-500">
          {album}
        </p>

        <p className="line-clamp-2 text-sm text-stone-600">
          {media.description}
        </p>

        <div className="flex items-center justify-between">

          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs">
            {media.category}
          </span>

          <div className="flex gap-2">

            <Button
              size="icon"
              variant="outline"
              onClick={() => onEdit(media)}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="destructive"
              onClick={() => onDelete(media)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>

          </div>

        </div>

      </div>

    </div>
  );
}
