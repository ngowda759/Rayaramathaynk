import { Metadata } from "next";
import CreateAaradhane from "@/components/admin/aaradhane/CreateAaradhane";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";

export const metadata: Metadata = {
  title: "Add Aaradhane | Admin",
  description: "Add a new aaradhane event to the temple calendar",
};

export default function CreateAaradhanePage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Add Aaradhane"
        description="Add a new aaradhane event with rituals, offerings, and significance."
      />
      <CreateAaradhane />
    </div>
  );
}
