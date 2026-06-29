import { CrudColumn } from "@/types/crud";
import { GalleryImage } from "@/types/gallery";

export const galleryColumns: CrudColumn<GalleryImage>[] = [
  {
    key: "imagePath",
    header: "Image",
    type: "image",
  },
  {
    key: "title",
    header: "Title",
    sortable: true,
  },
  {
    key: "category",
    header: "Category",
    sortable: true,
  },
  {
    key: "isFeatured",
    header: "Featured",
    formatter: (value) =>
      value ? "⭐ Featured" : "-",
  },
  {
    key: "displayOrder",
    header: "Order",
    type: "number",
    sortable: true,
  },
  {
    key: "actions",
    header: "Actions",
    type: "actions",
  },
];
