import {
  GALLERY_CATEGORIES,
} from "@/types/gallery";

export const galleryCategoryOptions =
  GALLERY_CATEGORIES.map((category) => ({
    label: category,
    value: category,
  }));
