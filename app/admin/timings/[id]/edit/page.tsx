"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import TimingForm from "@/components/admin/timings/TimingForm";

import { timingService } from "@/services/timing.service";
import {
  TempleTiming,
  TimingRequest,
} from "@/types/timing";

export default function EditTimingPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [timing, setTiming] =
    useState<TempleTiming | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadTiming() {
      try {
        const data =
          await timingService.getTimingById(id);

        if (!data) {
          toast.error("Timing not found.");
          router.push("/admin/timings");
          return;
        }

        setTiming(data);
      } catch (error) {
        console.error(
          "Failed to load timing:",
          error
        );

        toast.error("Failed to load timing.");

        router.push("/admin/timings");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadTiming();
    }
  }, [id, router]);

  async function handleUpdate(
    data: TimingRequest
  ) {
    try {
      setSaving(true);

      await timingService.updateTiming(id, data);

      toast.success("Timing updated successfully.");

      router.push("/admin/timings");
    } catch (error) {
      console.error(
        "Failed to update timing:",
        error
      );

      toast.error("Failed to update timing.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Edit Temple Timing"
          description="Loading..."
        />

        <div className="rounded-xl border bg-white p-8">
          Loading timing...
        </div>
      </div>
    );
  }

  if (!timing) return null;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Edit Temple Timing"
        description="Update temple timing."
      />

      <TimingForm
        mode="edit"
        loading={saving}
        initialValues={timing}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
