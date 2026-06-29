import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import {
  GalleryImage,
  GalleryImageRequest,
  GalleryStats,
} from "@/types/gallery";

const COLLECTION_NAME = "gallery";

function docToGalleryImage(docSnap: any): GalleryImage {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title || "",
    description: data.description || "",
    category: data.category || "Other",
    imagePath: data.imagePath || "",
    altText: data.altText || "",
    uploadedAt: data.uploadedAt?.toDate
      ? data.uploadedAt.toDate().toISOString()
      : data.uploadedAt || new Date().toISOString(),
    uploadedBy: data.uploadedBy || "",
    isFeatured: data.isFeatured ?? false,
    displayOrder: data.displayOrder ?? 0,
    tags: data.tags || [],
  };
}

export const galleryService = {
  async getImages(): Promise<GalleryImage[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("displayOrder", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docToGalleryImage);
  },

  async getImageById(id: string): Promise<GalleryImage | null> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docToGalleryImage(docSnap);
  },

  async createImage(
    data: GalleryImageRequest,
    userEmail: string
  ): Promise<string> {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      uploadedBy: userEmail,
      uploadedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateImage(
    id: string,
    data: Partial<GalleryImageRequest>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  async deleteImage(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  async getStats(): Promise<GalleryStats> {
    const images = await this.getImages();
    const byCategory: Record<string, number> = {};
    images.forEach((img) => {
      byCategory[img.category] = (byCategory[img.category] || 0) + 1;
    });
    return {
      total: images.length,
      featured: images.filter((i) => i.isFeatured).length,
      byCategory,
    };
  },
};
