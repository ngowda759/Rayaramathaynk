import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GalleryAlbum, GalleryMedia, GalleryMediaRequest } from "@/types/gallery";

const ALBUM_COLLECTION = "galleryAlbums";
const MEDIA_COLLECTION = "galleryMedia";

// Default gallery images from local assets
export const DEFAULT_GALLERY_IMAGES: GalleryMedia[] = [
  {
    id: "default-1",
    albumId: "temple",
    title: "Ananda - Divine Bliss",
    description: "Experience divine bliss at the temple",
    category: "Daily Pooja",
    type: "photo",
    imagePath: "/images/temple/Ananda.jpg",
    altText: "Temple deity - Ananda",
    uploadedBy: "system",
    isFeatured: true,
    displayOrder: 1,
    tags: ["bliss", "deity"],
  },
  {
    id: "default-2",
    albumId: "temple",
    title: "Bhakti - Devotion",
    description: "Devotees in prayer",
    category: "Daily Pooja",
    type: "photo",
    imagePath: "/images/temple/Bhakti.jpg",
    altText: "Devotees in prayer",
    uploadedBy: "system",
    isFeatured: true,
    displayOrder: 2,
    tags: ["devotion", "prayer"],
  },
  {
    id: "default-3",
    albumId: "temple",
    title: "Prahallada - Devotee of Lord Narayana",
    description: "Story of Prahallada's devotion",
    category: "Aaradhane",
    type: "photo",
    imagePath: "/images/temple/Prahallada 1.jpg",
    altText: "Prahallada depiction",
    uploadedBy: "system",
    isFeatured: true,
    displayOrder: 3,
    tags: ["aaradhane", "narayana"],
  },
  {
    id: "default-4",
    albumId: "temple",
    title: "Prasada - Sacred Offering",
    description: "Prasada offered to the deity",
    category: "Special Sevas",
    type: "photo",
    imagePath: "/images/temple/Prasada.jpg",
    altText: "Prasada offering",
    uploadedBy: "system",
    isFeatured: true,
    displayOrder: 4,
    tags: ["prasada", "offering"],
  },
  {
    id: "default-5",
    albumId: "temple",
    title: "Seva - Service to God",
    description: "Devotees serving the temple",
    category: "Special Sevas",
    type: "photo",
    imagePath: "/images/temple/Seva.jpg",
    altText: "Temple service",
    uploadedBy: "system",
    isFeatured: true,
    displayOrder: 5,
    tags: ["seva", "service"],
  },
  {
    id: "default-6",
    albumId: "temple",
    title: "Shraddha - Faith",
    description: "Faith in the divine",
    category: "Daily Pooja",
    type: "photo",
    imagePath: "/images/temple/Shraddha.jpg",
    altText: "Devotional faith",
    uploadedBy: "system",
    isFeatured: true,
    displayOrder: 6,
    tags: ["faith", "devotion"],
  },
  {
    id: "default-7",
    albumId: "temple",
    title: "Tapas - Spiritual Practice",
    description: "Spiritual austerity and practice",
    category: "Utsava",
    type: "photo",
    imagePath: "/images/temple/Tapas.jpg",
    altText: "Spiritual practice",
    uploadedBy: "system",
    isFeatured: true,
    displayOrder: 7,
    tags: ["tapas", "spiritual"],
  },
];

export const galleryService = {
  async getAlbums(): Promise<GalleryAlbum[]> {
    if (!db) return [];
    try {
      const q = query(collection(db, ALBUM_COLLECTION), orderBy("displayOrder", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<GalleryAlbum, "id">) }));
    } catch (error) {
      console.error("[GalleryService] Error:", error);
      return [];
    }
  },

  async getAlbum(id: string): Promise<GalleryAlbum | null> {
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, ALBUM_COLLECTION, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...(snap.data() as Omit<GalleryAlbum, "id">) };
    } catch (error) {
      console.error("[GalleryService] Error:", error);
      return null;
    }
  },

  async createAlbum(album: Omit<GalleryAlbum, "id">): Promise<string> {
    if (!db) throw new Error("Firebase not configured");
    const ref = await addDoc(collection(db, ALBUM_COLLECTION), { ...album, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return ref.id;
  },

  async updateAlbum(id: string, album: Partial<GalleryAlbum>): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await updateDoc(doc(db, ALBUM_COLLECTION, id), { ...album, updatedAt: serverTimestamp() });
  },

  async deleteAlbum(id: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await deleteDoc(doc(db, ALBUM_COLLECTION, id));
  },

  async getMedia(): Promise<GalleryMedia[]> {
    try {
      if (!db) {
        // Return default images if Firebase is not configured
        return DEFAULT_GALLERY_IMAGES;
      }
      const q = query(collection(db, MEDIA_COLLECTION), orderBy("displayOrder", "asc"));
      const snapshot = await getDocs(q);
      const images = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<GalleryMedia, "id">) }));
      
      // If no images in Firebase, return defaults
      if (images.length === 0) {
        console.log("[GalleryService] No images in Firebase, using default images");
        return DEFAULT_GALLERY_IMAGES;
      }
      
      return images;
    } catch (error) {
      console.error("[GalleryService] Error:", error);
      // Return default images on error
      return DEFAULT_GALLERY_IMAGES;
    }
  },

  async getImages(): Promise<GalleryMedia[]> {
    return this.getMedia();
  },

  async getMediaByAlbum(albumId: string): Promise<GalleryMedia[]> {
    if (!db) return [];
    try {
      const q = query(collection(db, MEDIA_COLLECTION), where("albumId", "==", albumId), orderBy("displayOrder", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<GalleryMedia, "id">) }));
    } catch (error) {
      console.error("[GalleryService] Error:", error);
      return [];
    }
  },

  async getFeaturedMedia(): Promise<GalleryMedia[]> {
    if (!db) return [];
    try {
      const q = query(collection(db, MEDIA_COLLECTION), where("isFeatured", "==", true), orderBy("displayOrder", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<GalleryMedia, "id">) }));
    } catch (error) {
      console.error("[GalleryService] Error:", error);
      return [];
    }
  },

  async getMediaById(id: string): Promise<GalleryMedia | null> {
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, MEDIA_COLLECTION, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...(snap.data() as Omit<GalleryMedia, "id">) };
    } catch (error) {
      console.error("[GalleryService] Error:", error);
      return null;
    }
  },

  async getImageById(id: string): Promise<GalleryMedia | null> {
    return this.getMediaById(id);
  },

  async createMedia(media: GalleryMediaRequest, uploadedBy: string): Promise<string> {
    if (!db) throw new Error("Firebase not configured");
    const ref = await addDoc(collection(db, MEDIA_COLLECTION), { albumId: media.albumId ?? "temple", type: media.type ?? "photo", ...media, uploadedBy, uploadedAt: serverTimestamp() });
    return ref.id;
  },

  async createImage(data: GalleryMediaRequest, uploadedBy: string): Promise<string> {
    return this.createMedia(data, uploadedBy);
  },

  async updateMedia(id: string, media: Partial<GalleryMediaRequest>): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await updateDoc(doc(db, MEDIA_COLLECTION, id), { ...media });
  },

  async updateImage(id: string, data: Partial<GalleryMediaRequest>): Promise<void> {
    return this.updateMedia(id, data);
  },

  async deleteMedia(id: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    await deleteDoc(doc(db, MEDIA_COLLECTION, id));
  },

  async deleteImage(id: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured");
    return this.deleteMedia(id);
  },

  async getStats() {
    if (!db) return { albums: 0, total: 0, featured: 0, photos: 0, videos: 0 };
    try {
      const [albums, media] = await Promise.all([this.getAlbums(), this.getMedia()]);
      return { albums: albums.length, total: media.length, featured: media.filter((m) => m.isFeatured).length, photos: media.filter((m) => m.type === "photo").length, videos: media.filter((m) => m.type === "video").length };
    } catch (error) {
      console.error("[GalleryService] Error:", error);
      return { albums: 0, total: 0, featured: 0, photos: 0, videos: 0 };
    }
  },
};
