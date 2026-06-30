"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}

export default function DeleteDialog({
  open,
  title,
  description,
  onClose,
  onDelete,
}: Props) {
  async function handleDelete() {
    await onDelete();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>

        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-stone-600">
          {description}
        </p>

        <DialogFooter>

          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            onClick={handleDelete}
          >
            Delete
          </Button>

        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
