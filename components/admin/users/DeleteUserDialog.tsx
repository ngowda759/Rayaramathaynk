"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { userService } from "@/services/user.service";

interface Props {
  id: string;
  name: string;
}

export default function DeleteUserDialog({
  id,
  name,
}: Props) {
  const router = useRouter();

  async function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"?`
    );

    if (!confirmed) return;

    try {
      await userService.deleteUser(id);

      router.refresh();
      router.push("/admin/users");
    } catch (error) {
      console.error(error);
      alert("Unable to delete user.");
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 hover:bg-red-200"
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </button>
  );
}
