import { Metadata } from "next";
import { notFound } from "next/navigation";
import EditImage from "@/components/admin/gallery/EditImage";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

interface EditGalleryPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditGalleryPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Edit Gallery Image | Admin",
    description: `Edit gallery image ${id}`,
  };
}

export default async function EditGalleryPage({ params }: EditGalleryPageProps) {
  const { id } = await params;
  if (!id) notFound();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Edit Gallery Image"
        description="Update gallery image details, category, and visibility."
      />
      <EditImage imageId={id} />
    </div>
  );
}
