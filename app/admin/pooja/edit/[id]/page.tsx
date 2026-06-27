import { Metadata } from "next";
import { notFound } from "next/navigation";
import EditPooja from "@/components/admin/pooja/EditPooja";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

interface EditPoojaPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditPoojaPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Edit Daily Pooja | Admin",
    description: `Edit pooja ${id}`,
  };
}

export default async function EditPoojaPage({ params }: EditPoojaPageProps) {
  const { id } = await params;
  if (!id) notFound();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Edit Daily Pooja"
        description="Update pooja details, timings, seva amount, and schedule."
      />
      <EditPooja poojaId={id} />
    </div>
  );
}
