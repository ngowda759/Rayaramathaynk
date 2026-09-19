"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Video, Play, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const previewDimensions = {
    sm: "h-32",
    md: "h-48",
    lg: "h-64",
  };

  const handleUpload = async (file: File) => {
    setError(null);

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File must be less than ${maxSizeMB}MB`);
      return;
    }

    // Validate type (basic check, server will also validate)
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/ogg'];
    if (!validTypes.includes(file.type) && !file.type.startsWith('video/')) {
      setError(`File must be a supported video format. Try MP4 or WebM.`);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10); // Initial progress

      // Simulate progress since we can't easily track native fetch upload progress without XHR
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + 5;
        });
      }, 500);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);

      const response = await fetch('/api/storage/upload-video', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload video');
      }

      setUploadProgress(100);
      const result = await response.json();
      onChange(result.url);

    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload video. Please try again.");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  // Helper to get filename from URL
  const getFilename = (url: string) => {
    try {
      return url.split('/').pop() || "Video File";
    } catch (e) {
      return "Video File";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-stone-50 group">
          <div className={`${previewDimensions[previewSize]} relative flex flex-col items-center justify-center p-4`}>

            {/* Show simple video preview if it's an mp4 or webm, otherwise generic icon */}
            {(value.endsWith('.mp4') || value.endsWith('.webm')) ? (
              <video
                src={value}
                controls
                className="h-full w-full object-contain rounded bg-black/5"
                controlsList="nodownload"
                preload="metadata"
              />
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="rounded-full bg-blue-50 p-4">
                  <Play className="h-8 w-8 text-blue-500 ml-1" />
                </div>
                <p className="text-sm font-medium text-stone-600 truncate max-w-[200px]">
                  {getFilename(value)}
                </p>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Open in new tab
                </a>
              </div>
            )}

            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onChange("")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragOver
              ? "border-blue-500 bg-blue-50/50"
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
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleUpload(e.target.files[0]);
              }
            }}
          />

          <div className="flex flex-col items-center space-y-3 text-stone-500 text-center">
            {uploading ? (
              <div className="flex flex-col items-center w-full max-w-xs space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <div className="w-full">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">Uploading video...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-stone-400">Please wait, this may take a moment</p>
              </div>
            ) : (
              <>
                <div className="rounded-full bg-stone-100 p-4 transition-transform group-hover:scale-110">
                  <FileVideo className="h-8 w-8 text-stone-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-700">Click or drag video to upload</p>
                  <p className="text-xs text-stone-400 mt-1">
                    MP4, WebM up to {maxSizeMB}MB
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2">
                  <Upload className="h-4 w-4 mr-2" />
                  Select File
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
    </div>
  );
}
