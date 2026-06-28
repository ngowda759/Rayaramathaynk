"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import TimingForm from "@/components/admin/timings/TimingForm";
import { timingService } from "@/services/timing.service";
import { TempleTiming } from "@/types/timing";

interface PageProps {
  params: { id: string };
}

export default function EditTimingPage({ params }: PageProps) {
  const [timing, setTiming] = useState<TempleTiming | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTiming() {
      try {
        const data = await timingService.getTimingById(params.id);
        if (!data) {
          setError("Timing not found.");
          return;
        }
        setTiming(data);
      } catch (err) {
        console.error("Failed to load timing:", err);
        setError("Unable to load timing. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    loadTiming();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border bg-white p-8">
        Loading timing...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin/timings" className="text-stone-600 hover:text-stone-900">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h2 className="text-lg font-semibold">Timing not found</h2>
        </div>
        <p className="text-sm text-stone-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Edit Temple Timing"
        description="Update the timing details and visibility for this schedule item."
      />
      {timing && <TimingForm initialData={timing} />}
    </div>
  );
}
