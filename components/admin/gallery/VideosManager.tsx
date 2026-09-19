"use client";

import { useState } from "react";
import { Video, Trash2, ExternalLink, RefreshCw, Upload, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { storageService } from "@/services/storage.service";

interface BlobVideo {
  url: string;
  pathname: string;
  size: number;
}

interface Props {
  videos: BlobVideo[];
  onRefresh: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function VideosManager({ videos, onRefresh }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<BlobVideo | null>(null);

  async function handleDelete(video: BlobVideo) {
    if (!confirm(`Delete video "${video.pathname}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(video.url);
    try {
      await storageService.deleteFile(video.url);
      onRefresh();
    } catch (error) {
      console.error("Failed to delete video:", error);
      alert("Failed to delete video. Please try again.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Video size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Vercel Blob Videos</h2>
            <p className="text-sm text-stone-500">
              {videos.length} video{videos.length !== 1 ? "s" : ""} stored at gallery/videos/
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
          <Video className="mx-auto h-12 w-12 text-stone-300" />
          <h3 className="mt-4 font-medium text-stone-600">No videos in Blob Storage</h3>
          <p className="mt-2 text-sm text-stone-500">
            Upload videos from the Gallery page by adding media with type "Video".
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <div
              key={video.url}
              className="group relative overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md"
            >
              {/* Video Preview */}
              <div className="relative aspect-video bg-black">
                <video
                  src={video.url}
                  className="h-full w-full object-contain"
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setSelectedVideo(video)}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-stone-900 hover:bg-white"
                  >
                    <Play className="ml-1 h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Video Info */}
              <div className="p-4">
                <p className="truncate text-sm font-medium" title={video.pathname}>
                  {video.pathname.split("/").pop()}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {formatFileSize(video.size)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t p-3">
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-stone-100 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-200"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </a>
                <button
                  onClick={() => handleDelete(video)}
                  disabled={deleting === video.url}
                  className="flex items-center justify-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {deleting === video.url ? "..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedVideo(null)}
              className="absolute -top-10 right-0 flex items-center gap-2 text-white hover:text-gray-300"
            >
              <span className="text-sm">Close</span>
              <span className="text-2xl">&times;</span>
            </button>
            <video
              src={selectedVideo.url}
              controls
              autoPlay
              className="w-full rounded-lg"
            />
            <div className="mt-4 text-white">
              <p className="font-medium">{selectedVideo.pathname}</p>
              <p className="mt-1 text-sm text-gray-400">
                {formatFileSize(selectedVideo.size)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
