"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
  Eye,
} from "lucide-react";

function isVideoPath(path: string) {
  return /\.(mp4|webm|ogg)$/i.test(path);
}

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { GalleryImage } from "@/types/gallery";
import { galleryService } from "@/services/gallery.service";

interface GalleryTableProps {
  images: GalleryImage[];
  onRefresh: () => void;
}

export default function GalleryTable({ images, onRefresh }: GalleryTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await galleryService.deleteImage(deleteId);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete image:", err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  async function moveOrder(id: string, direction: "up" | "down") {
    const index = images.findIndex((i) => i.id === id);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === images.length - 1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = images[index];
    const swap = images[swapIndex];

    try {
      await galleryService.updateImage(current.id, {
        displayOrder: swap.displayOrder,
      });
      await galleryService.updateImage(swap.id, {
        displayOrder: current.displayOrder,
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to reorder:", err);
    }
  }

  async function toggleFeatured(id: string, current: boolean) {
    try {
      await galleryService.updateImage(id, { isFeatured: !current });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle featured:", err);
    }
  }

  function formatDate(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">Order</TableHead>
              <TableHead className="w-20">Image</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {images.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  No images found. Add your first gallery image.
                </TableCell>
              </TableRow>
            ) : (
              images.map((image, index) => (
                <TableRow key={image.id}>
                  <TableCell>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0}
                          onClick={() => moveOrder(image.id, "up")}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === images.length - 1}
                          onClick={() => moveOrder(image.id, "down")}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setPreviewImage(image)}
                      className="relative block h-12 w-12 overflow-hidden rounded-lg border"
                    >
                      {isVideoPath(image.imagePath) ? (
                        <video
                          src={image.imagePath}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          loop
                        />
                      ) : (
                        <Image
                          src={image.imagePath}
                          alt={image.altText}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{image.title}</div>
                    <div className="max-w-xs truncate text-xs text-muted-foreground">
                      {image.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                      {image.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        toggleFeatured(image.id, image.isFeatured)
                      }
                      className={
                        image.isFeatured
                          ? "text-yellow-500 hover:text-yellow-600"
                          : "text-muted-foreground hover:text-foreground"
                      }
                    >
                      <Star
                        className="h-4 w-4"
                        fill={image.isFeatured ? "currentColor" : "none"}
                      />
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(image.uploadedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewImage(image)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/admin/gallery/edit/${image.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(image.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              This will remove the image record from Firestore. The actual file
              in the public folder must be deleted manually via Git.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewImage}
        onOpenChange={() => setPreviewImage(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewImage?.title}</DialogTitle>
            <DialogDescription>{previewImage?.description}</DialogDescription>
          </DialogHeader>
          {previewImage && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              {isVideoPath(previewImage.imagePath) ? (
                <video
                  src={previewImage.imagePath}
                  controls
                  className="h-full w-full object-contain"
                />
              ) : (
                <Image
                  src={previewImage.imagePath}
                  alt={previewImage.altText}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 700px"
                />
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
              {previewImage?.category}
            </span>
            {previewImage?.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
