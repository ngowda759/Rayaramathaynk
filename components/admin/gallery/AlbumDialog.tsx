"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { GalleryAlbum } from "@/types/gallery";

interface Props {
  open: boolean;
  album?: GalleryAlbum | null;
  onClose: () => void;
  onSave: (
    data: Omit<GalleryAlbum, "id">
  ) => Promise<void>;
}

export default function AlbumDialog({
  open,
  album,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [active, setActive] = useState(true);

  useEffect(() => {
     
    if (!album) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle("");
       
      setSlug("");
       
      setDescription("");
       
      setCoverImage("");
       
      setDisplayOrder(0);
       
      setActive(true);
      return;
    }
     
    setTitle(album.title);
     
    setSlug(album.slug);
     
    setDescription(album.description);
     
    setCoverImage(album.coverImage);
     
    setDisplayOrder(album.displayOrder);
     
    setActive(album.active);
  }, [album]);

  async function save() {
    await onSave({
      title,
      slug,
      description,
      coverImage,
      active,
      displayOrder,
    });

    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">

        <DialogHeader>
          <DialogTitle>
            {album ? "Edit Album" : "New Album"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">

          <div>
            <Label>Album Name</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label>Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
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
            <Label>Cover Image</Label>
            <Input
              value={coverImage}
              onChange={(e) =>
                setCoverImage(e.target.value)
              }
              placeholder="/images/temple/rathotsava.jpg"
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

          <div className="flex items-center justify-between rounded-xl border p-4">

            <div>
              <Label>Active</Label>
            </div>

            <Switch
              checked={active}
              onCheckedChange={setActive}
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

          <Button onClick={save}>
            Save Album
          </Button>

        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
