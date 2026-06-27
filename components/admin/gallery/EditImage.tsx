"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { GalleryImage, GALLERY_CATEGORIES } from "@/types/gallery";
import { galleryService } from "@/services/gallery.service";

interface EditImageProps {
  imageId: string;
}

export default function EditImage({ imageId }: EditImageProps) {
  const router = useRouter();

  const [image, setImage] = useState<GalleryImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await galleryService.getImageById(imageId);
        if (!data) {
          router.push("/admin/gallery");
          return;
        }
        setImage(data);
      } catch (err) {
        console.error("Failed to load image:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [imageId, router]);

  function validate() {
    const next: Record<string, string> = {};
    if (!image) return false;
    if (!image.title.trim()) next.title = "Title is required";
    if (!image.category) next.category = "Category is required";
    if (!image.imagePath.trim()) next.imagePath = "Image path is required";
    if (!image.altText.trim()) next.altText = "Alt text is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function updateField<K extends keyof GalleryImage>(
    field: K,
    value: GalleryImage[K]
  ) {
    if (!image) return;
    setImage({ ...image, [field]: value });
  }

  function addTag() {
    const trimmed = tagInput.trim();
    if (!trimmed || !image) return;
    if (image.tags.includes(trimmed)) return;
    updateField("tags", [...image.tags, trimmed]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    if (!image) return;
    updateField(
      "tags",
      image.tags.filter((t) => t !== tag)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!image || !validate()) return;

    setSaving(true);
    try {
      await galleryService.updateImage(image.id, {
        title: image.title.trim(),
        description: image.description.trim(),
        category: image.category,
        imagePath: image.imagePath.trim(),
        altText: image.altText.trim(),
        isFeatured: image.isFeatured,
        displayOrder: image.displayOrder,
        tags: image.tags,
      });
      router.push("/admin/gallery");
    } catch (err) {
      console.error("Failed to update image:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!image) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={image.title}
              onChange={(e) => updateField("title", e.target.value)}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={image.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={image.category}
              onValueChange={(v) => updateField("category", v as any)}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GALLERY_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="imagePath">
              Image Path <span className="text-destructive">*</span>
            </Label>
            <Input
              id="imagePath"
              value={image.imagePath}
              onChange={(e) => updateField("imagePath", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Path relative to the public folder.
            </p>
            {errors.imagePath && (
              <p className="text-xs text-destructive">{errors.imagePath}</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="altText">
              Alt Text <span className="text-destructive">*</span>
            </Label>
            <Input
              id="altText"
              value={image.altText}
              onChange={(e) => updateField("altText", e.target.value)}
            />
            {errors.altText && (
              <p className="text-xs text-destructive">{errors.altText}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayOrder">Display Order</Label>
            <Input
              id="displayOrder"
              type="number"
              value={image.displayOrder}
              onChange={(e) =>
                updateField(
                  "displayOrder",
                  parseInt(e.target.value || "0", 10)
                )
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="featured">Featured on Homepage</Label>
              <p className="text-xs text-muted-foreground">
                Show this image in the homepage gallery preview
              </p>
            </div>
            <Switch
              id="featured"
              checked={image.isFeatured}
              onCheckedChange={(v) => updateField("isFeatured", v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag and press Enter"
              />
              <Button type="button" variant="outline" onClick={addTag}>
                Add
              </Button>
            </div>
            {image.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {image.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex cursor-pointer items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} &times;
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/gallery")}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Update Image
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
