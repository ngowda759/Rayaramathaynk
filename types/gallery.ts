export interface GalleryImage {
  id: string;
  title: string;
  description: string;
  category: GalleryCategory;
  imagePath: string;
  altText: string;
  uploadedAt: string;
  uploadedBy: string;
  isFeatured: boolean;
  displayOrder: number;
  tags: string[];
}

export type GalleryCategory =
  | "Rathotsava"
  | "Madhva Navami"
  | "Aaradhane"
  | "Daily Pooja"
  | "Special Sevas"
  | "Utsava"
  | "Pravachana"
  | "Temple Infrastructure"
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
  "Other",
];

export interface GalleryStats {
  total: number;
  featured: number;
  byCategory: Record<string, number>;
}

export interface GalleryImageRequest {
  title: string;
  description: string;
  category: GalleryCategory;
  imagePath: string;
  altText: string;
  isFeatured: boolean;
  displayOrder: number;
  tags: string[];
}
