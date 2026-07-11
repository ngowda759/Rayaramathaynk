"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  GalleryAlbum,
  GalleryCategory,
  GalleryMedia,
  GALLERY_CATEGORIES,
} from "@/types/gallery";

interface Props {
  open: boolean;
  media?: GalleryMedia | null;
  albums: GalleryAlbum[];
  onClose: () => void;
  onSave: (data: Omit<GalleryMedia, "id">) => Promise<void>;
}

export default function MediaDialog({
  open,
  media,
  albums,
  onClose,
  onSave,
}: Props) {
  const [albumId, setAlbumId] = useState("");
  const [type, setType] = useState<"photo" | "video">("photo");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] =
    useState<GalleryCategory>("Other");
  const [imagePath, setImagePath] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [featured, setFeatured] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [tags, setTags] = useState("");

  useEffect(() => {
     
    if (media) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlbumId(media.albumId);
       
      setType(media.type);
       
      setTitle(media.title);
       
      setDescription(media.description);
       
      setCategory(media.category);
       
      setImagePath(media.imagePath);
       
      setVideoUrl(media.videoUrl ?? "");
       
      setAltText(media.altText);
       
      setFeatured(media.isFeatured);
       
      setDisplayOrder(media.displayOrder);
       
      setTags((media.tags ?? []).join(", "));
    } else {
       
      setAlbumId(albums.length ? albums[0].id : "");
       
      setType("photo");
       
      setTitle("");
       
      setDescription("");
       
      setCategory("Other");
       
      setImagePath("");
       
      setVideoUrl("");
       
      setAltText("");
       
      setFeatured(false);
       
      setDisplayOrder(0);
       
      setTags("");
    }
  }, [media, albums]);

  async function handleSave() {
    await onSave({
      albumId,
      type,
      title,
      description,
      category,
      imagePath,
      videoUrl,
      altText,
      uploadedAt: new Date(),
      uploadedBy: "admin",
      isFeatured: featured,
      displayOrder,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });

    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">

        <DialogHeader>
          <DialogTitle>
            {media ? "Edit Media" : "Add Media"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">

          <div>
            <Label>Album</Label>

            <Select
              value={albumId}
              onValueChange={(value) =>
                setAlbumId(value ?? "")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Album" />
              </SelectTrigger>

              <SelectContent>
                {albums.map((album) => (
                  <SelectItem
                    key={album.id}
                    value={album.id}
                  >
                    {album.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>

          <div>
            <Label>Media Type</Label>

            <Select
              value={type}
              onValueChange={(value) => {
                if (value) {
                  setType(value as "photo" | "video");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="photo">
                  Photo
                </SelectItem>

                <SelectItem value="video">
                  Video
                </SelectItem>
              </SelectContent>

            </Select>

          </div>

          <div>
            <Label>Title</Label>

            <Input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
            />
          </div>

          <div>
            <Label>Description</Label>

            <Textarea
              rows={3}
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
            />
          </div>

          <div>
            <Label>Category</Label>

            <Select
              value={category}
              onValueChange={(value) => {
                if (value) {
                  setCategory(value as GalleryCategory);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {GALLERY_CATEGORIES.map((cat) => (
                  <SelectItem
                    key={cat}
                    value={cat}
                  >
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>

            </Select>

          </div>

          {type === "photo" ? (
            <div>
              <Label>Image Path</Label>

              <Input
                value={imagePath}
                onChange={(e) =>
                  setImagePath(e.target.value)
                }
              />
            </div>
          ) : (
            <div>
              <Label>YouTube URL</Label>

              <Input
                value={videoUrl}
                onChange={(e) =>
                  setVideoUrl(e.target.value)
                }
              />
            </div>
          )}

          <div>
            <Label>Alt Text</Label>

            <Input
              value={altText}
              onChange={(e) =>
                setAltText(e.target.value)
              }
            />
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

          <div>
            <Label>Tags</Label>

            <Input
              value={tags}
              onChange={(e) =>
                setTags(e.target.value)
              }
              placeholder="festival, pooja, rayara"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-4">

            <Label>Featured</Label>

            <Switch
              checked={featured}
              onCheckedChange={setFeatured}
            />

          </div>

        </div>

        <DialogFooter>

          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button onClick={handleSave}>
            Save
          </Button>

        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
