"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ImagePlus, Loader2 } from "lucide-react";

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

import {
  GALLERY_CATEGORIES,
  GalleryCategory,
} from "@/types/gallery";

import { galleryService } from "@/services/gallery.service";

export default function CreateImage() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<GalleryCategory | "">("");
  const [imagePath, setImagePath] = useState("");
  const [altText, setAltText] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(0);

  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const next: Record<string, string> = {};

    if (!title.trim()) next.title = "Title is required";
    if (!category) next.category = "Category is required";
    if (!imagePath.trim()) next.imagePath = "Image path is required";
    if (!altText.trim()) next.altText = "Alt text is required";

    setErrors(next);

    return Object.keys(next).length === 0;
  }

  function addTag() {
    const value = tagInput.trim();

    if (!value) return;
    if (tags.includes(value)) return;

    setTags([...tags, value]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;
    if (!user?.email) return;

    setSaving(true);

    try {
      await galleryService.createImage(
        {
          albumId: "temple",
          type: "photo",

          title: title.trim(),
          description: description.trim(),

          category: category as GalleryCategory,

          imagePath: imagePath.trim(),

          videoUrl: "",

          altText: altText.trim(),

          isFeatured,

          displayOrder,

          tags,
        },
        user.email
      );

      router.push("/admin/gallery");
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <div className="space-y-6">

          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label>Category</Label>

            <Select
              value={category}
              onValueChange={(v) => setCategory(v as GalleryCategory)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>

              <SelectContent>
                {GALLERY_CATEGORIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {errors.category && (
              <p className="text-sm text-red-500">{errors.category}</p>
            )}
          </div>

          <div>
            <Label>Image Path</Label>

            <Input
              value={imagePath}
              onChange={(e) => setImagePath(e.target.value)}
              placeholder="/images/gallery/temple/photo1.webp"
            />

            {errors.imagePath && (
              <p className="text-sm text-red-500">{errors.imagePath}</p>
            )}
          </div>

        </div>

        <div className="space-y-6">

          <div>
            <Label>Alt Text</Label>

            <Input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
            />

            {errors.altText && (
              <p className="text-sm text-red-500">{errors.altText}</p>
            )}
          </div>

          <div>
            <Label>Display Order</Label>

            <Input
              type="number"
              value={displayOrder}
              onChange={(e) =>
                setDisplayOrder(Number(e.target.value))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">

            <div>
              <Label>Featured</Label>

              <p className="text-sm text-muted-foreground">
                Show on homepage gallery
              </p>
            </div>

            <Switch
              checked={isFeatured}
              onCheckedChange={setIsFeatured}
            />

          </div>

          <div>

            <Label>Tags</Label>

            <div className="mt-2 flex gap-2">

              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />

              <Button
                type="button"
                variant="outline"
                onClick={addTag}
              >
                Add
              </Button>

            </div>

            <div className="mt-3 flex flex-wrap gap-2">

              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full bg-amber-100 px-3 py-1 text-sm"
                >
                  {tag} ×
                </button>
              ))}

            </div>

          </div>

        </div>

      </div>

      <div className="flex justify-end gap-3">

        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/gallery")}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <ImagePlus className="mr-2 h-4 w-4" />
              Add Image
            </>
          )}
        </Button>

      </div>

    </form>
  );
}
