import { Metadata } from "next";
import { notFound } from "next/navigation";
import EditAaradhane from "@/components/admin/aaradhane/EditAaradhane";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

interface EditAaradhanePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditAaradhanePageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Edit Aaradhane | Admin",
    description: `Edit aaradhane ${id}`,
  };
}

export default async function EditAaradhanePage({ params }: EditAaradhanePageProps) {
  const { id } = await params;
  if (!id) notFound();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Edit Aaradhane"
        description="Update aaradhane details, rituals, offerings, and schedule."
      />
      <EditAaradhane aaradhaneId={id} />
    </div>
  );
}
