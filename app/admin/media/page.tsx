"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Search,
  Filter,
  Grid,
  List,
  Upload,
  X,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  FolderOpen,
  Calendar,
  Tag,
  ChevronRight
} from "lucide-react";
import { db, storage } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy,
  deleteDoc,
  doc,
  serverTimestamp 
} from "firebase/firestore";
import { ref, listAll, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/hooks/useAuth";

interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video" | "document";
  name: string;
  folder: string;
  size?: number;
  createdAt?: Date;
  uploadedBy?: string;
  thumbnailUrl?: string;
}

type ViewMode = "grid" | "list";
type MediaFilter = "all" | "image" | "video" | "document";

const defaultMedia: MediaItem[] = [
  { id: "1", url: "/images/Hero.jpg", type: "image", name: "Hero Banner", folder: "images" },
  { id: "2", url: "/images/gallery/sample1.jpg", type: "image", name: "Temple Exterior", folder: "gallery" },
  { id: "3", url: "/images/gallery/sample2.jpg", type: "image", name: "Daily Pooja", folder: "gallery" },
];

export default function MediaLibraryPage() {
  const { profile } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>(["images", "gallery", "events", "sevas"]);
  const [selectedFolder, setSelectedFolder] = useState<string>("all");

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const galleryMedia: MediaItem[] = [];
      const albumImages: MediaItem[] = [];
      
      // In a real implementation, this would fetch from a dedicated media collection
      // For now, we'll use gallery data and default media
      if (db) {
        const gallerySnap = await getDocs(collection(db, "galleryMedia"));
        
        gallerySnap.docs.forEach(doc => {
          const data = doc.data();
          galleryMedia.push({
            id: doc.id,
            url: data.url || data.imageUrl || "",
            type: data.type === "video" ? "video" : "image",
            name: data.caption || data.title || "Untitled",
            folder: data.albumId || "gallery",
            createdAt: data.uploadedAt?.toDate(),
            uploadedBy: data.uploadedBy,
          });
        });

        // Also load gallery albums
        const albumsSnap = await getDocs(collection(db, "galleryAlbums"));
        
        albumsSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.coverImage) {
            albumImages.push({
              id: doc.id,
              url: data.coverImage,
              type: "image",
              name: data.title || "Album Cover",
              folder: "albums",
              createdAt: data.createdAt?.toDate(),
            });
          }
        });
      }

      setMedia([...defaultMedia, ...galleryMedia, ...albumImages]);

      // Extract unique folders
      const allFolders = new Set(["all", ...defaultMedia.map(m => m.folder), ...galleryMedia.map(m => m.folder)]);
      setFolders(Array.from(allFolders));
    } catch (error) {
      console.error("Error loading media:", error);
      // Use default media on error
      setMedia(defaultMedia);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Data fetching pattern
    loadMedia();
  }, [loadMedia]);

  const filteredMedia = media.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || item.type === filter;
    const matchesFolder = selectedFolder === "all" || item.folder === selectedFolder;
    return matchesSearch && matchesFilter && matchesFolder;
  });

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="w-6 h-6 text-purple-500" />;
      case "document":
        return <FileText className="w-6 h-6 text-red-500" />;
      default:
        return <ImageIcon className="w-6 h-6 text-blue-500" />;
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-stone-200 rounded w-1/4" />
            <div className="h-12 bg-stone-200 rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-48 bg-stone-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-stone-500 mb-2">
            <Link href="/admin" className="hover:text-amber-600">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-stone-700">Media Library</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-stone-900">Media Library</h1>
              <p className="text-stone-600 mt-1">
                {filteredMedia.length} {filteredMedia.length === 1 ? "file" : "files"}
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
              <Upload className="w-5 h-5" />
              Upload Media
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                type="text"
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Folder Filter */}
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-stone-400" />
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {folders.map(folder => (
                  <option key={folder} value={folder}>
                    {folder === "all" ? "All Folders" : folder.charAt(0).toUpperCase() + folder.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-stone-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as MediaFilter)}
                className="px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">All Types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
                <option value="document">Documents</option>
              </select>
            </div>

            {/* View Mode */}
            <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-amber-100 text-amber-700" : "text-stone-500 hover:bg-stone-50"}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-amber-100 text-amber-700" : "text-stone-500 hover:bg-stone-50"}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Media Grid/List */}
        {filteredMedia.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
            <ImageIcon className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-stone-700 mb-2">No media found</h3>
            <p className="text-stone-500">
              {searchQuery ? "Try adjusting your search or filters" : "Upload your first media file"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredMedia.map((item) => (
              <div
                key={item.id}
                className="group relative bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-lg hover:border-amber-300 transition-all cursor-pointer"
                onClick={() => setSelectedMedia(item)}
              >
                <div className="aspect-square bg-stone-100 relative">
                  {item.type === "image" ? (
                    <Image
                      src={item.url}
                      alt={item.name}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/placeholder.png";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {getMediaIcon(item.type)}
                    </div>
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(item.url);
                        }}
                        className="p-2 bg-white rounded-full hover:bg-stone-100"
                        title="Copy URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(item.url, "_blank");
                        }}
                        className="p-2 bg-white rounded-full hover:bg-stone-100"
                        title="Open"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="p-3">
                  <p className="font-medium text-stone-700 truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Tag className="w-3 h-3 text-stone-400" />
                    <span className="text-xs text-stone-500">{item.folder}</span>
                    {item.size && (
                      <>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs text-stone-500">{formatSize(item.size)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Preview</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Folder</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Size</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-stone-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedia.map((item) => (
                  <tr key={item.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 rounded-lg bg-stone-100 overflow-hidden relative">
                        {item.type === "image" ? (
                          <Image src={item.url} alt={item.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {getMediaIcon(item.type)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-700">{item.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-stone-600 capitalize">
                        {getMediaIcon(item.type)}
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-stone-100 rounded text-sm text-stone-600">
                        <FolderOpen className="w-3 h-3" />
                        {item.folder}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-500">
                      {formatSize(item.size) || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(item.url)}
                          className="p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-700"
                          title="Copy URL"
                        >
                          {copiedUrl === item.url ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => window.open(item.url, "_blank")}
                          className="p-1.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-700"
                          title="Open"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Media Detail Modal */}
        {selectedMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-stone-200">
                <h3 className="font-semibold text-stone-900">{selectedMedia.name}</h3>
                <button
                  onClick={() => setSelectedMedia(null)}
                  className="p-2 rounded-lg hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 max-h-[60vh] overflow-auto">
                {selectedMedia.type === "image" ? (
                  <div className="relative aspect-video bg-stone-100 rounded-lg overflow-hidden">
                    <Image
                      src={selectedMedia.url}
                      alt={selectedMedia.name}
                      fill
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-stone-100 rounded-lg flex items-center justify-center">
                    {getMediaIcon(selectedMedia.type)}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-stone-200 bg-stone-50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-stone-500">URL</p>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={selectedMedia.url}
                        readOnly
                        className="flex-1 px-3 py-2 border border-stone-200 rounded-lg bg-white text-xs font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(selectedMedia.url)}
                        className="px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                      >
                        {copiedUrl === selectedMedia.url ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-stone-500">Details</p>
                    <div className="flex gap-4 mt-1 text-stone-700">
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {selectedMedia.folder}
                      </span>
                      {selectedMedia.createdAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {selectedMedia.createdAt.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
