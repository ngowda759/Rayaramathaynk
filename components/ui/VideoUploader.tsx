"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Video, Play, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { storageService } from "@/services/storage.service";

interface VideoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  maxSizeMB?: number;
  previewSize?: "sm" | "md" | "lg";
}

export default function VideoUploader({
  value,
  onChange,
  label = "Upload Video",
  maxSizeMB = 100,
  previewSize = "md",
}: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-32",
    md: "h-48",
    lg: "h-64",
  };

  const handleFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file");
      return;
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      // Upload to Vercel Blob Storage
      const result = await storageService.uploadVideo(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      onChange(result.url);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
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

  const clearVideo = () => {
    onChange("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
          // Show video preview
          <div className={`relative ${sizeClasses[previewSize]} overflow-hidden rounded-lg bg-black`}>
            <video
              src={value}
              controls
              className="h-full w-full object-contain"
              preload="metadata"
            />
            <button
              type="button"
              onClick={clearVideo}
              className="absolute right-2 top-2 rounded-full bg-destructive p-1.5 text-destructive-foreground hover:bg-destructive/90"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                Video uploaded
              </span>
            </div>
          </div>
        ) : (
          // Show upload area
          <div className="flex flex-col items-center justify-center p-6">
            {uploading ? (
              <div className="w-full max-w-xs">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                <div className="mt-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <FileVideo className="h-8 w-8 text-primary" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Drag & drop a video file here, or click to browse
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Max {maxSizeMB}MB • MP4, WebM, MOV
                </p>
              </>
            )}
            <Input
              ref={inputRef}
              type="file"
              accept="video/*"
              onChange={handleInputChange}
              disabled={uploading}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose Video
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* URL input for external video URLs */}
      {previewSize === "md" && (
        <div className="mt-2">
          <Input
            placeholder="Or paste video URL (Vercel Blob, YouTube, etc.)"
            value={value.startsWith("http") ? value : ""}
            onChange={(e) => {
              if (e.target.value.startsWith("http")) {
                onChange(e.target.value);
              }
            }}
          />
        </div>
      )}

      {/* Info about Vercel Blob */}
      {previewSize === "md" && !value && (
        <p className="text-xs text-muted-foreground">
          Videos uploaded here will be stored in Vercel Blob at gallery/videos/
        </p>
      )}
    </div>
  );
}
