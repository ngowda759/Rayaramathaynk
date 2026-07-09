/**
 * Repository for managing gallery albums and media.
 * This repository provides CRUD operations for gallery using JSON storage.
 */

import { GalleryAlbum, GalleryMedia, GalleryMediaRequest } from "@/types/gallery";
import { readJson, writeJson, generateId } from "@/lib/storage";

const ALBUMS_FILE = "galleryAlbums.json";
const MEDIA_FILE = "galleryMedia.json";

interface AlbumsData {
  items: GalleryAlbum[];
}

interface MediaData {
  items: GalleryMedia[];
}

export const galleryRepository = {
  // ===========================
  // Albums
  // ===========================

  /**
   * Get all albums, sorted by display order
   */
  async getAllAlbums(): Promise<GalleryAlbum[]> {
    const data = await readJson<AlbumsData>(ALBUMS_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      return orderA - orderB;
    });
  },

  /**
   * Get album by ID
   */
  async getAlbumById(id: string): Promise<GalleryAlbum | null> {
    const data = await readJson<AlbumsData>(ALBUMS_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new album
   */
  async createAlbum(album: Omit<GalleryAlbum, "id">): Promise<GalleryAlbum> {
    const data = await readJson<AlbumsData>(ALBUMS_FILE) || { items: [] };
    const now = Date.now();

    const newAlbum: GalleryAlbum = {
      ...album,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    data.items.push(newAlbum);
    await writeJson(ALBUMS_FILE, data);

    return newAlbum;
  },

  /**
   * Update an existing album
   */
  async updateAlbum(
    id: string,
    updates: Partial<Omit<GalleryAlbum, "id">>
  ): Promise<GalleryAlbum | null> {
    const data = await readJson<AlbumsData>(ALBUMS_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: GalleryAlbum = {
      ...data.items[index],
      ...updates,
      id: data.items[index].id,
      createdAt: data.items[index].createdAt,
      updatedAt: Date.now(),
    };

    data.items[index] = updated;
    await writeJson(ALBUMS_FILE, data);

    return updated;
  },

  /**
   * Delete an album
   */
  async deleteAlbum(id: string): Promise<boolean> {
    const data = await readJson<AlbumsData>(ALBUMS_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(ALBUMS_FILE, data);
    return true;
  },

  // ===========================
  // Media
  // ===========================

  /**
   * Get all media, sorted by display order
   */
  async getAllMedia(): Promise<GalleryMedia[]> {
    const data = await readJson<MediaData>(MEDIA_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      return orderA - orderB;
    });
  },

  /**
   * Get media by album ID
   */
  async getMediaByAlbum(albumId: string): Promise<GalleryMedia[]> {
    const items = await this.getAllMedia();
    return items
      .filter((item) => item.albumId === albumId)
      .sort((a, b) => {
        const orderA = a.displayOrder ?? 0;
        const orderB = b.displayOrder ?? 0;
        return orderA - orderB;
      });
  },

  /**
   * Get featured media
   */
  async getFeaturedMedia(): Promise<GalleryMedia[]> {
    const items = await this.getAllMedia();
    return items
      .filter((item) => item.isFeatured)
      .sort((a, b) => {
        const orderA = a.displayOrder ?? 0;
        const orderB = b.displayOrder ?? 0;
        return orderA - orderB;
      });
  },

  /**
   * Get media by ID
   */
  async getMediaById(id: string): Promise<GalleryMedia | null> {
    const data = await readJson<MediaData>(MEDIA_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create new media
   */
  async createMedia(
    media: GalleryMediaRequest,
    uploadedBy: string
  ): Promise<GalleryMedia> {
    const data = await readJson<MediaData>(MEDIA_FILE) || { items: [] };
    const now = Date.now();

    const newMedia: GalleryMedia = {
      id: generateId(),
      albumId: media.albumId ?? "temple",
      title: media.title,
      description: media.description,
      category: media.category,
      type: media.type ?? "photo",
      imagePath: media.imagePath,
      videoUrl: media.videoUrl,
      altText: media.altText,
      uploadedAt: now,
      uploadedBy,
      isFeatured: media.isFeatured,
      displayOrder: media.displayOrder,
      tags: media.tags,
    };

    data.items.push(newMedia);
    await writeJson(MEDIA_FILE, data);

    return newMedia;
  },

  /**
   * Update existing media
   */
  async updateMedia(
    id: string,
    updates: Partial<GalleryMediaRequest>
  ): Promise<GalleryMedia | null> {
    const data = await readJson<MediaData>(MEDIA_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: GalleryMedia = {
      ...data.items[index],
      ...updates,
      id: data.items[index].id,
      uploadedAt: data.items[index].uploadedAt,
      uploadedBy: data.items[index].uploadedBy,
    };

    data.items[index] = updated;
    await writeJson(MEDIA_FILE, data);

    return updated;
  },

  /**
   * Delete media
   */
  async deleteMedia(id: string): Promise<boolean> {
    const data = await readJson<MediaData>(MEDIA_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(MEDIA_FILE, data);
    return true;
  },

  // ===========================
  // Statistics
  // ===========================

  /**
   * Get gallery statistics
   */
  async getStats() {
    const [albums, media] = await Promise.all([
      this.getAllAlbums(),
      this.getAllMedia(),
    ]);

    return {
      albums: albums.length,
      total: media.length,
      featured: media.filter((m) => m.isFeatured).length,
      photos: media.filter((m) => m.type === "photo").length,
      videos: media.filter((m) => m.type === "video").length,
    };
  },

  /**
   * Get the count of all media
   */
  async countMedia(): Promise<number> {
    const data = await readJson<MediaData>(MEDIA_FILE);
    return data?.items.length || 0;
  },

  /**
   * Get the count of all albums
   */
  async countAlbums(): Promise<number> {
    const data = await readJson<AlbumsData>(ALBUMS_FILE);
    return data?.items.length || 0;
  },
};
