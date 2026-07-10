"use client";

import Image from "next/image";
import { useState } from "react";
import { Clipboard, Trash2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { galleryService } from "@/services/gallery.service";

interface LocalAsset {
  id: string;
  src: string;
  title: string;
  alt: string;
}

interface LocalGalleryAssetsProps {
  localImages: LocalAsset[];
  localVideos: LocalAsset[];
  existingPaths: string[];
  onDelete: () => void;
  onAdd: () => void;
}

export default function LocalGalleryAssets({
  localImages,
  localVideos,
  existingPaths,
  onDelete,
  onAdd,
}: LocalGalleryAssetsProps) {
  const { user } = useAuth();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  async function handleCopy(src: string) {
    await navigator.clipboard.writeText(src);
  }

  async function handleDelete(src: string) {
    if (!confirm(`Delete ${src} from public folder? This cannot be undone here.`)) {
      return;
    }
    setDeleting(src);
    try {
      const response = await fetch("/api/gallery/local-assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src }),
      });
      if (!response.ok) {
        throw new Error("Could not delete file");
      }
      onDelete();
    } catch (error) {
      console.error("Failed to delete local asset:", error);
      alert("Failed to delete file. Check the server logs.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleAddToGallery(asset: LocalAsset) {
    if (!user?.email) {
      alert("You must be logged in to add gallery items.");
      return;
    }
    setAdding(asset.src);
    try {
      await galleryService.createImage(
        {
          title: asset.title,
          description: "",
          category: "Temple Infrastructure",
          imagePath: asset.src,
          altText: asset.alt,
          isFeatured: false,
          displayOrder: 0,
          tags: [],
        },
        user.email
      );
      onAdd();
    } catch (error) {
      console.error("Failed to add local asset to gallery:", error);
      alert("Failed to add to gallery. Check the console for details.");
    } finally {
      setAdding(null);
    }
  }

  function renderAssetCard(asset: LocalAsset, isVideo?: boolean) {
    const alreadyAdded = existingPaths.includes(asset.src);

    return (
      <div
        key={asset.id}
        className="overflow-hidden rounded-3xl border border-stone-200 bg-stone-50"
      >
        <div className="relative h-44 w-full bg-black">
          {isVideo ? (
            <video
              controls
              className="h-full w-full object-cover"
              src={asset.src}
            />
          ) : (
            <Image
              src={asset.src}
              alt={asset.alt}
              fill
              className="object-cover"
            />
          )}
        </div>
        <div className="space-y-3 p-4">
          <div>
            <p className="font-semibold text-stone-900">{asset.title}</p>
            <p className="text-xs text-stone-600 break-all">{asset.src}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => handleCopy(asset.src)}
            >
              <Clipboard className="h-4 w-4" />
              Copy path
            </Button>
            {!alreadyAdded && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={adding === asset.src}
                onClick={() => handleAddToGallery(asset)}
              >
                <Plus className="h-4 w-4" />
                {adding === asset.src ? "Adding..." : "Add to gallery"}
              </Button>
            )}
            {alreadyAdded && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                Already in gallery
              </span>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              disabled={deleting === asset.src}
              onClick={() => handleDelete(asset.src)}
            >
              <Trash2 className="h-4 w-4" />
              {deleting === asset.src ? "Deleting..." : "Delete file"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Local Gallery Assets
            </h2>
            <p className="text-sm leading-6 text-stone-600">
              These files exist in the public folder but are not yet stored in the
              Firestore gallery collection.
            </p>
          </div>
        </div>
      </div>

      {localImages.length === 0 && localVideos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-12 text-center text-stone-600">
          No local gallery assets found in <code>public/images/temple</code> or <code>public/videos</code>.
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {localImages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-stone-900">Local Images</h3>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {localImages.length}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {localImages.map((image) => renderAssetCard(image))}
              </div>
            </div>
          )}

          {localVideos.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-stone-900">Local Videos</h3>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  {localVideos.length}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-1">
                {localVideos.map((video) => renderAssetCard(video, true))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
