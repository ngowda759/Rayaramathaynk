"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UploadFolder = 'testimonials' | 'gallery' | 'videos' | 'aaradhane' | 'events' | 'profile' | 'donations' | 'sevas' | 'reports';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder: UploadFolder;
  label?: string;
  accept?: string;
  maxSizeMB?: number;
  previewSize?: "sm" | "md" | "lg";
}

export default function ImageUploader({
  value,
  onChange,
  folder,
  label = "Upload Image",
  accept = "image/*",
  maxSizeMB = 5,
  previewSize = "md",
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const previewDimensions = {
    sm: "h-24 w-24",
    md: "h-40 w-40",
    lg: "h-64 w-full",
  };

  const generateFilename = (originalName: string, prefix?: string): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = originalName.split('.').pop() || 'jpg';
    const cleanName = prefix
      ? `${prefix}_${timestamp}_${random}`
      : `${timestamp}_${random}`;
    return `${cleanName}.${ext}`;
  };

  const handleUpload = async (file: File) => {
    setError(null);

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File must be less than ${maxSizeMB}MB`);
      return;
    }

    // Validate type
    if (!file.type.startsWith("image/")) {
      setError("File must be an image");
      return;
    }

    try {
      setUploading(true);

      // Convert to base64 for upload
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const filename = generateFilename(
          file.name,
          folder.replace(/s$/, "") // singularize folder name for prefix
        );

        // Upload to API
        const formData = new FormData();
        formData.append('base64', base64);
        formData.append('filename', filename);
        formData.append('folder', folder);

        const response = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
           const errorData = await response.json();
           throw new Error(errorData.error || 'Failed to upload image');
        }

        const result = await response.json();
        onChange(result.url);
      };

      reader.onerror = () => {
        setError("Failed to read file");
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ... (rest of the component UI remains the same)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {value ? (
        <div className="relative overflow-hidden rounded-lg border bg-stone-50">
          <div className={`${previewDimensions[previewSize]} relative flex items-center justify-center`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Uploaded preview"
              className="h-full w-full object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 rounded-full shadow-sm opacity-90 hover:opacity-100"
              onClick={() => onChange("")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            dragOver
              ? "border-amber-500 bg-amber-50/50"
              : "border-stone-200 hover:bg-stone-50"
          } ${error ? "border-red-500 bg-red-50" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <Input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleUpload(e.target.files[0]);
              }
            }}
          />

          <div className="flex flex-col items-center space-y-2 text-stone-500">
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                <p className="text-sm font-medium">Uploading...</p>
              </>
            ) : (
              <>
                <div className="rounded-full bg-stone-100 p-3">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Click or drag image to upload</p>
                  <p className="text-xs text-stone-400">
                    PNG, JPG, WEBP up to {maxSizeMB}MB
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
