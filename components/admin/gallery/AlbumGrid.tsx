"use client";

import Image from "next/image";
import { Pencil, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GalleryAlbum } from "@/types/gallery";

interface Props {
  albums: GalleryAlbum[];
  onEdit: (album: GalleryAlbum) => void;
  onDelete: (album: GalleryAlbum) => void;
}

export default function AlbumGrid({
  albums,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Albums</h2>

        <span className="text-sm text-stone-500">
          {albums.length} Albums
        </span>
      </div>

      {albums.length === 0 ? (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <FolderOpen
            size={60}
            className="mx-auto text-stone-300"
          />

          <h3 className="mt-5 text-xl font-semibold">
            No Albums
          </h3>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {albums.map((album) => (
            <div
              key={album.id}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-xl"
            >
              <div className="relative h-48 bg-stone-100">
                {album.coverImage ? (
                  <Image
                    src={album.coverImage}
                    alt={album.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FolderOpen
                      size={60}
                      className="text-stone-300"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 p-5">
                <h3 className="text-lg font-bold">
                  {album.title}
                </h3>

                <p className="line-clamp-2 text-sm text-stone-500">
                  {album.description}
                </p>

                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      album.active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {album.active ? "Active" : "Hidden"}
                  </span>

                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => onEdit(album)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => onDelete(album)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
