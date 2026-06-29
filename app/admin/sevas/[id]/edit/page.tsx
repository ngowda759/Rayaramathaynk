"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SevaForm from "@/components/admin/sevas/SevaForm";

import { sevaService } from "@/services/seva.service";
import { Seva, SevaRequest } from "@/types/seva";

export default function EditSevaPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [seva, setSeva] = useState<Seva | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSeva() {
      try {
        const data = await sevaService.getSevaById(id);

        if (!data) {
          toast.error("Seva not found.");
          router.push("/admin/sevas");
          return;
        }

        setSeva(data);
      } catch (error) {
        console.error("Failed to load seva:", error);
        toast.error("Failed to load seva.");
        router.push("/admin/sevas");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadSeva();
    }
  }, [id, router]);

  async function handleUpdate(data: SevaRequest) {
    try {
      setSaving(true);

      await sevaService.updateSeva(id, data);

      toast.success("Seva updated successfully.");

      router.push("/admin/sevas");
    } catch (error) {
      console.error("Failed to update seva:", error);
      toast.error("Failed to update seva.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Edit Seva"
          description="Loading seva..."
        />

        <div className="rounded-xl border bg-white p-8 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (!seva) {
    return null;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Edit Seva"
        description="Update temple seva."
      />

      <SevaForm
        mode="edit"
        initialValues={seva}
        loading={saving}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
