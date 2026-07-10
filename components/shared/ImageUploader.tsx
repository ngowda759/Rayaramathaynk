"use client";

import { useState } from "react";
import { storageService } from "@/services/storage.service";

interface Props {
  folder: string;
  onUploadComplete(url: string): void;
}

export default function ImageUploader({
  folder,
  onUploadComplete,
}: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);

      const url = await storageService.uploadImage(
        file,
        folder
      );

      onUploadComplete(url);
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />

      {uploading && (
        <p className="text-sm text-blue-600">
          Uploading...
        </p>
      )}
    </div>
  );
}
