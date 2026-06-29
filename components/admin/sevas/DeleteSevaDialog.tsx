"use client";

import { useState } from "react";

import Button from "@/components/ui/button";

interface DeleteSevaDialogProps {
  sevaName: string;
  onConfirm: () => Promise<void>;
}

export default function DeleteSevaDialog({
  sevaName,
  onConfirm,
}: DeleteSevaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    try {
      setLoading(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">
          Delete Seva
        </h2>

        <p className="mt-3 text-sm text-stone-600">
          Are you sure you want to delete{" "}
          <strong>{sevaName}</strong>?
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            loading={loading}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
