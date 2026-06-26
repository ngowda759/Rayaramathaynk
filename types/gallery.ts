export interface GalleryItem {
  id?: string;

  title: string;

  description: string;

  imageUrl: string;

  category: string;

  featured: boolean;

  createdAt?: Date;
}
