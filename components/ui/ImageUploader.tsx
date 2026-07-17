"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { storageService, UploadFolder } from "@/services/storage.service";

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

  const sizeClasses = {
    sm: "h-20 w-20",
    md: "h-32 w-full",
    lg: "h-48 w-full",
  };

  const handleFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Please select an image or video file");
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);
      
      // Generate filename
      const filename = storageService.generateFilename(
        file.name,
        folder
      );

      // Upload to Vercel Blob
      const result = await storageService.uploadBase64Image(
        base64,
        filename,
        folder
      );

      onChange(result.url);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearImage = () => {
    onChange("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      
      <div
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {value ? (
          // Show preview
          <div className={`relative ${sizeClasses[previewSize]} overflow-hidden rounded-lg`}>
            {value.startsWith("data:") || value.startsWith("http") ? (
              <img
                src={value}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={`/images/${folder}/${value}`}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            )}
            <button
              type="button"
              onClick={clearImage}
              className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          // Show upload area
          <div className="flex flex-col items-center justify-center p-6">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop or click to upload
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Max {maxSizeMB}MB • Image or video
                </p>
              </>
            )}
            <Input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={handleInputChange}
              disabled={uploading}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Choose File
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* URL input for external images */}
      {previewSize === "md" && (
        <div className="mt-2">
          <Input
            placeholder="Or paste image URL"
            value={value.startsWith("http") ? value : ""}
            onChange={(e) => {
              if (e.target.value.startsWith("http")) {
                onChange(e.target.value);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
