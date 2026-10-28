import { apiFetch } from "@/lib/api/fetch";
import { GalleryAlbum, GalleryMedia, GalleryMediaRequest } from "@/types/gallery";

/**
 * Gallery albums and media, stored in Supabase `gallery_albums` / `gallery_media`.
 *
 * The browser never talks to Supabase directly: both tables are deny-all under RLS,
 * so this module calls the same-origin `/api/gallery/**` routes, which read with the
 * service role and require an authenticated administrator for every write. There is
 * no Firestore path. `DEFAULT_GALLERY_IMAGES` is the local-asset fallback the public
 * page already relied on; it is not Firestore content.
 */

export const DEFAULT_GALLERY_IMAGES: GalleryMedia[] = [
  { id: "default-1", albumId: "temple", title: "Ananda - Divine Bliss", description: "Experience divine bliss at the temple", category: "Daily Pooja", type: "photo", imagePath: "/images/temple/Ananda.jpg", altText: "Temple deity - Ananda", uploadedBy: "system", isFeatured: true, displayOrder: 1, tags: ["bliss", "deity"] },
  { id: "default-2", albumId: "temple", title: "Bhakti - Devotion", description: "Devotees in prayer", category: "Daily Pooja", type: "photo", imagePath: "/images/temple/Bhakti.jpg", altText: "Devotees in prayer", uploadedBy: "system", isFeatured: true, displayOrder: 2, tags: ["devotion", "prayer"] },
  { id: "default-3", albumId: "temple", title: "Prahallada - Devotee of Lord Narayana", description: "Story of Prahallada's devotion", category: "Aaradhane", type: "photo", imagePath: "/images/temple/Prahallada 1.jpg", altText: "Prahallada depiction", uploadedBy: "system", isFeatured: true, displayOrder: 3, tags: ["aaradhane", "narayana"] },
  { id: "default-4", albumId: "temple", title: "Prasada - Sacred Offering", description: "Prasada offered to the deity", category: "Special Sevas", type: "photo", imagePath: "/images/temple/Prasada.jpg", altText: "Prasada offering", uploadedBy: "system", isFeatured: true, displayOrder: 4, tags: ["prasada", "offering"] },
  { id: "default-5", albumId: "temple", title: "Seva - Service to God", description: "Devotees serving the temple", category: "Special Sevas", type: "photo", imagePath: "/images/temple/Seva.jpg", altText: "Temple service", uploadedBy: "system", isFeatured: true, displayOrder: 5, tags: ["seva", "service"] },
  { id: "default-6", albumId: "temple", title: "Shraddha - Faith", description: "Faith in the divine", category: "Daily Pooja", type: "photo", imagePath: "/images/temple/Shraddha.jpg", altText: "Devotional faith", uploadedBy: "system", isFeatured: true, displayOrder: 6, tags: ["faith", "devotion"] },
  { id: "default-7", albumId: "temple", title: "Tapas - Spiritual Practice", description: "Spiritual austerity and practice", category: "Utsava", type: "photo", imagePath: "/images/temple/Tapas.jpg", altText: "Spiritual practice", uploadedBy: "system", isFeatured: true, displayOrder: 7, tags: ["tapas", "spiritual"] },
];

export const galleryService = {
  async getAlbums(): Promise<GalleryAlbum[]> {
    return apiFetch<GalleryAlbum[]>("/api/gallery/albums", { auth: false });
  },

  async getAlbum(id: string): Promise<GalleryAlbum | null> {
    try {
      return await apiFetch<GalleryAlbum>(`/api/gallery/albums/${encodeURIComponent(id)}`, { auth: false });
    } catch {
      return null;
    }
  },

  async createAlbum(album: Omit<GalleryAlbum, "id">): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/gallery/albums", {
      method: "POST",
      body: album,
    });
    return id;
  },

  async updateAlbum(id: string, album: Partial<GalleryAlbum>): Promise<void> {
    await apiFetch(`/api/gallery/albums/${encodeURIComponent(id)}`, { method: "PUT", body: album });
  },

  async deleteAlbum(id: string): Promise<void> {
    await apiFetch(`/api/gallery/albums/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async getMedia(): Promise<GalleryMedia[]> {
    const media = await apiFetch<GalleryMedia[]>("/api/gallery/media", { auth: false });
    return media.length > 0 ? media : DEFAULT_GALLERY_IMAGES;
  },

  async getImages(): Promise<GalleryMedia[]> {
    return this.getMedia();
  },

  async getMediaByAlbum(albumId: string): Promise<GalleryMedia[]> {
    return apiFetch<GalleryMedia[]>(`/api/gallery/media?album=${encodeURIComponent(albumId)}`, { auth: false });
  },

  async getFeaturedMedia(): Promise<GalleryMedia[]> {
    return apiFetch<GalleryMedia[]>("/api/gallery/media?featured=1", { auth: false });
  },

  async getMediaById(id: string): Promise<GalleryMedia | null> {
    try {
      return await apiFetch<GalleryMedia>(`/api/gallery/media/${encodeURIComponent(id)}`, { auth: false });
    } catch {
      return null;
    }
  },

  async getImageById(id: string): Promise<GalleryMedia | null> {
    return this.getMediaById(id);
  },

  async createMedia(media: GalleryMediaRequest, uploadedBy: string): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/gallery/media", {
      method: "POST",
      body: { media, uploadedBy },
    });
    return id;
  },

  async createImage(data: GalleryMediaRequest, uploadedBy: string): Promise<string> {
    return this.createMedia(data, uploadedBy);
  },

  async updateMedia(id: string, media: Partial<GalleryMediaRequest>): Promise<void> {
    await apiFetch(`/api/gallery/media/${encodeURIComponent(id)}`, { method: "PUT", body: media });
  },

  async updateImage(id: string, data: Partial<GalleryMediaRequest>): Promise<void> {
    return this.updateMedia(id, data);
  },

  async deleteMedia(id: string): Promise<void> {
    await apiFetch(`/api/gallery/media/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async deleteImage(id: string): Promise<void> {
    return this.deleteMedia(id);
  },

  async getStats() {
    const [albums, media] = await Promise.all([this.getAlbums(), this.getMedia()]);
    return {
      albums: albums.length,
      total: media.length,
      featured: media.filter((m) => m.isFeatured).length,
      photos: media.filter((m) => m.type === "photo").length,
      videos: media.filter((m) => m.type === "video").length,
    };
  },
};
