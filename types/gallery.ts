export type GalleryCategory =
  | "Rathotsava"
  | "Madhva Navami"
  | "Aaradhane"
  | "Daily Pooja"
  | "Special Sevas"
  | "Utsava"
  | "Pravachana"
  | "Temple Infrastructure"
  | "Annadanam"
  | "Hanuman Jayanti"
  | "Guru Aaradhane"
  | "Other";

export const GALLERY_CATEGORIES: GalleryCategory[] = [
  "Rathotsava",
  "Madhva Navami",
  "Aaradhane",
  "Daily Pooja",
  "Special Sevas",
  "Utsava",
  "Pravachana",
  "Temple Infrastructure",
  "Annadanam",
  "Hanuman Jayanti",
  "Guru Aaradhane",
  "Other",
];

export interface GalleryAlbum {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImage: string;
  active: boolean;
  displayOrder: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface GalleryMedia {
  id: string;
  albumId: string;
  title: string;
  description: string;
  category: GalleryCategory;
  type: "photo" | "video";
  imagePath: string;
  videoUrl?: string;
  altText: string;
  uploadedAt?: any;
  uploadedBy: string;
  isFeatured: boolean;
  displayOrder: number;
  tags: string[];
}

export interface GalleryMediaRequest {
  // Optional for backward compatibility
  albumId?: string;
  type?: "photo" | "video";

  title: string;
  description: string;
  category: GalleryCategory;

  imagePath: string;
  videoUrl?: string;

  altText: string;

  isFeatured: boolean;
  displayOrder: number;
  tags: string[];
}

export interface GalleryStats {
  total: number;
  featured: number;
  albums: number;
  photos: number;
  videos: number;
  byCategory?: Record<string, number>;
}

/* ------------------------------------------------------------------
   BACKWARD COMPATIBILITY
------------------------------------------------------------------- */

export type GalleryImage = GalleryMedia;

export type GalleryImageRequest = GalleryMediaRequest;
