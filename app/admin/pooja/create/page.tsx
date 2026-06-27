import { Metadata } from "next";
import CreatePooja from "@/components/admin/pooja/CreatePooja";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

export const metadata: Metadata = {
  title: "Add Daily Pooja | Admin",
  description: "Add a new pooja to the daily temple schedule",
};

export default function CreatePoojaPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Add Daily Pooja"
        description="Add a new pooja to the temple daily schedule with timings, seva amount, and applicable days."
      />
      <CreatePooja />
    </div>
  );
}
