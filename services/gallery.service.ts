import {
  GalleryAlbum,
  GalleryMedia,
  GalleryMediaRequest,
} from "@/types/gallery";

import { galleryRepository } from "@/repositories";

export const galleryService = {
  // ===========================
  // Albums
  // ===========================

  async getAlbums(): Promise<GalleryAlbum[]> {
    return galleryRepository.getAllAlbums();
  },

  async getAlbum(id: string): Promise<GalleryAlbum | null> {
    return galleryRepository.getAlbumById(id);
  },

  async createAlbum(
    album: Omit<GalleryAlbum, "id">
  ): Promise<string> {
    const result = await galleryRepository.createAlbum(album);
    return result.id;
  },

  async updateAlbum(
    id: string,
    album: Partial<GalleryAlbum>
  ): Promise<void> {
    await galleryRepository.updateAlbum(id, album);
  },

  async deleteAlbum(id: string): Promise<void> {
    await galleryRepository.deleteAlbum(id);
  },

  // ===========================
  // Media
  // ===========================

  async getMedia(): Promise<GalleryMedia[]> {
    return galleryRepository.getAllMedia();
  },

  // Backward compatibility
  async getImages(): Promise<GalleryMedia[]> {
    return this.getMedia();
  },

  async getMediaByAlbum(
    albumId: string
  ): Promise<GalleryMedia[]> {
    return galleryRepository.getMediaByAlbum(albumId);
  },

  async getFeaturedMedia(): Promise<GalleryMedia[]> {
    return galleryRepository.getFeaturedMedia();
  },

  async getMediaById(
    id: string
  ): Promise<GalleryMedia | null> {
    return galleryRepository.getMediaById(id);
  },

  // Backward compatibility
  async getImageById(id: string): Promise<GalleryMedia | null> {
    return this.getMediaById(id);
  },

  async createMedia(
    media: GalleryMediaRequest,
    uploadedBy: string
  ): Promise<string> {
    const result = await galleryRepository.createMedia(media, uploadedBy);
    return result.id;
  },

  // Backward compatibility
  async createImage(
    data: GalleryMediaRequest,
    uploadedBy: string
  ): Promise<string> {
    return this.createMedia(data, uploadedBy);
  },

  async updateMedia(
    id: string,
    media: Partial<GalleryMediaRequest>
  ): Promise<void> {
    await galleryRepository.updateMedia(id, media);
  },

  // Backward compatibility
  async updateImage(
    id: string,
    data: Partial<GalleryMediaRequest>
  ): Promise<void> {
    return this.updateMedia(id, data);
  },

  async deleteMedia(id: string): Promise<void> {
    await galleryRepository.deleteMedia(id);
  },

  // Backward compatibility
  async deleteImage(id: string): Promise<void> {
    return this.deleteMedia(id);
  },

  // ===========================
  // Statistics
  // ===========================

  async getStats() {
    return galleryRepository.getStats();
  },
};
