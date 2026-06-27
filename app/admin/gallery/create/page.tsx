import { Metadata } from "next";
import CreateImage from "@/components/admin/gallery/CreateImage";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

export const metadata: Metadata = {
  title: "Add Gallery Image | Admin",
  description: "Add a new image to the temple gallery",
};

export default function CreateGalleryPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Add Gallery Image"
        description="Add a new image to the temple gallery. Ensure the image file is already committed to the public folder."
      />
      <CreateImage />
    </div>
  );
}
