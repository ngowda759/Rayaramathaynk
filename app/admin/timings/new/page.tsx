"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import TimingForm from "@/components/admin/timings/TimingForm";

import { timingService } from "@/services/timing.service";
import { TimingRequest } from "@/types/timing";

export default function NewTimingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function handleCreate(data: TimingRequest) {
    try {
      setLoading(true);

      await timingService.createTiming(data);

      toast.success("Timing created successfully.");

      router.push("/admin/timings");
    } catch (error) {
      console.error("Failed to create timing:", error);

      toast.error("Failed to create timing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Create Temple Timing"
        description="Add a new temple timing."
      />

      <TimingForm
        mode="create"
        loading={loading}
        onSubmit={handleCreate}
      />
    </div>
  );
}
