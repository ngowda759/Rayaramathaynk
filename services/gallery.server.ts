import "server-only";
import { rowIdFilter } from "@/lib/supabase/identifier";

import { createAdminClient } from "@/lib/supabase/admin";
import { GalleryAlbum, GalleryMedia, GalleryMediaRequest } from "@/types/gallery";

const ALBUM_TABLE = "gallery_albums";
const MEDIA_TABLE = "gallery_media";

/**
 * Gallery albums and media, stored in Supabase `gallery_albums` / `gallery_media`.
 *
 * Reads use the public client; writes use the service-role admin client (both tables
 * are deny-all under RLS). There is no Firestore path. `DEFAULT_GALLERY_IMAGES` is
 * retained as the local-asset fallback the public page already relied on; it is not
 * Firestore content.
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

function rowToAlbum(row: any): GalleryAlbum {
  return {
    id: row.firestore_id || row.id,
    title: row.title || "",
    slug: row.slug || "",
    description: row.description || "",
    coverImage: row.cover_image || "",
    active: row.active ?? true,
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as GalleryAlbum;
}

function rowToMedia(row: any): GalleryMedia {
  return {
    id: row.firestore_id || row.id,
    albumId: row.album_id || "",
    title: row.title || "",
    description: row.description || "",
    category: row.category || "",
    type: row.type || "photo",
    imagePath: row.image_path || "",
    videoUrl: row.video_url || undefined,
    altText: row.alt_text || "",
    isFeatured: row.is_featured ?? false,
    displayOrder: row.display_order ?? 0,
    tags: row.tags || [],
    uploadedBy: row.uploaded_by || "",
    uploadedAt: row.uploaded_at,
  } as GalleryMedia;
}

export const galleryService = {
  async getAlbums(): Promise<GalleryAlbum[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(ALBUM_TABLE)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Could not read gallery albums: ${error.message}`);
    return (data ?? []).map(rowToAlbum);
  },

  async getAlbum(id: string): Promise<GalleryAlbum | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(ALBUM_TABLE)
      .select("*")
      .or(rowIdFilter(id))
      .maybeSingle();
    if (error) throw new Error(`Could not read gallery album: ${error.message}`);
    return data ? rowToAlbum(data) : null;
  },

  async createAlbum(album: Omit<GalleryAlbum, "id">): Promise<string> {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(ALBUM_TABLE)
      .insert({
        title: album.title,
        slug: album.slug,
        description: album.description,
        cover_image: album.coverImage ?? "",
        active: album.active ?? true,
        display_order: album.displayOrder ?? 0,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create gallery album: ${error.message}`);
    return row.firestore_id || row.id;
  },

  async updateAlbum(id: string, album: Partial<GalleryAlbum>): Promise<void> {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (album.title !== undefined) update.title = album.title;
    if (album.slug !== undefined) update.slug = album.slug;
    if (album.description !== undefined) update.description = album.description;
    if (album.coverImage !== undefined) update.cover_image = album.coverImage;
    if (album.active !== undefined) update.active = album.active;
    if (album.displayOrder !== undefined) update.display_order = album.displayOrder;
    const { error } = await supabase.from(ALBUM_TABLE).update(update).or(rowIdFilter(id));
    if (error) throw new Error(`Could not update gallery album: ${error.message}`);
  },

  async deleteAlbum(id: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(ALBUM_TABLE).delete().or(rowIdFilter(id));
    if (error) throw new Error(`Could not delete gallery album: ${error.message}`);
  },

  async getMedia(): Promise<GalleryMedia[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(MEDIA_TABLE)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Could not read gallery media: ${error.message}`);
    const images = (data ?? []).map(rowToMedia);
    // The local-asset defaults remain the empty-state fallback, as before.
    return images.length > 0 ? images : DEFAULT_GALLERY_IMAGES;
  },

  async getImages(): Promise<GalleryMedia[]> {
    return this.getMedia();
  },

  async getMediaByAlbum(albumId: string): Promise<GalleryMedia[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(MEDIA_TABLE)
      .select("*")
      .eq("album_id", albumId)
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Could not read gallery media: ${error.message}`);
    return (data ?? []).map(rowToMedia);
  },

  async getFeaturedMedia(): Promise<GalleryMedia[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(MEDIA_TABLE)
      .select("*")
      .eq("is_featured", true)
      .order("display_order", { ascending: true });
    if (error) throw new Error(`Could not read featured gallery media: ${error.message}`);
    return (data ?? []).map(rowToMedia);
  },

  async getMediaById(id: string): Promise<GalleryMedia | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(MEDIA_TABLE)
      .select("*")
      .or(rowIdFilter(id))
      .maybeSingle();
    if (error) throw new Error(`Could not read gallery media: ${error.message}`);
    return data ? rowToMedia(data) : null;
  },

  async getImageById(id: string): Promise<GalleryMedia | null> {
    return this.getMediaById(id);
  },

  async createMedia(media: GalleryMediaRequest, uploadedBy: string): Promise<string> {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(MEDIA_TABLE)
      .insert({
        album_id: media.albumId ?? "temple",
        title: media.title,
        description: media.description,
        category: media.category,
        type: media.type ?? "photo",
        image_path: media.imagePath,
        video_url: media.videoUrl ?? null,
        alt_text: media.altText,
        is_featured: media.isFeatured ?? false,
        display_order: media.displayOrder ?? 0,
        tags: media.tags ?? [],
        uploaded_by: uploadedBy,
        uploaded_at: new Date().toISOString(),
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create gallery media: ${error.message}`);
    return row.firestore_id || row.id;
  },

  async createImage(data: GalleryMediaRequest, uploadedBy: string): Promise<string> {
    return this.createMedia(data, uploadedBy);
  },

  async updateMedia(id: string, media: Partial<GalleryMediaRequest>): Promise<void> {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (media.albumId !== undefined) update.album_id = media.albumId;
    if (media.title !== undefined) update.title = media.title;
    if (media.description !== undefined) update.description = media.description;
    if (media.category !== undefined) update.category = media.category;
    if (media.type !== undefined) update.type = media.type;
    if (media.imagePath !== undefined) update.image_path = media.imagePath;
    if (media.videoUrl !== undefined) update.video_url = media.videoUrl;
    if (media.altText !== undefined) update.alt_text = media.altText;
    if (media.isFeatured !== undefined) update.is_featured = media.isFeatured;
    if (media.displayOrder !== undefined) update.display_order = media.displayOrder;
    if (media.tags !== undefined) update.tags = media.tags;
    const { error } = await supabase.from(MEDIA_TABLE).update(update).or(rowIdFilter(id));
    if (error) throw new Error(`Could not update gallery media: ${error.message}`);
  },

  async updateImage(id: string, data: Partial<GalleryMediaRequest>): Promise<void> {
    return this.updateMedia(id, data);
  },

  async deleteMedia(id: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(MEDIA_TABLE).delete().or(rowIdFilter(id));
    if (error) throw new Error(`Could not delete gallery media: ${error.message}`);
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
