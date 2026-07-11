import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GalleryAlbum, GalleryMedia, GalleryMediaRequest } from "@/types/gallery";

const ALBUM_COLLECTION = "galleryAlbums";
const MEDIA_COLLECTION = "galleryMedia";

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
    if (!db) return [];
    try {
      const q = query(collection(db, MEDIA_COLLECTION), orderBy("displayOrder", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<GalleryMedia, "id">) }));
    } catch (error) {
      console.error("[GalleryService] Error:", error);
      return [];
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
