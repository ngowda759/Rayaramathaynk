"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SevaForm from "@/components/admin/sevas/SevaForm";

import { sevaService } from "@/services/seva.service";
import { SevaRequest } from "@/types/seva";

export default function NewSevaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function handleCreate(data: SevaRequest) {
    try {
      setLoading(true);

      await sevaService.createSeva(data);

      toast.success("Seva created successfully.");

      router.push("/admin/sevas");
    } catch (error) {
      console.error(error);

      toast.error("Failed to create seva.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Create Seva"
        description="Add a new seva."
      />

      <SevaForm
        mode="create"
        loading={loading}
        onSubmit={handleCreate}
      />
    </div>
  );
}
