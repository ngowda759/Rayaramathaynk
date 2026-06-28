import Link from "next/link";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import TimingForm from "@/components/admin/timings/TimingForm";

export default function NewTimingPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Add Temple Timing"
        description="Create a new temple timing entry for the public schedule."
      />
      <TimingForm />
    </div>
  );
}
