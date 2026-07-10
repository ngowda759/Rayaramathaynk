"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { userService } from "@/services/user.service";
import { TempleUser, UserRole } from "@/types/user";

interface UserFormProps {
  initialData?: TempleUser;
  mode?: "create" | "edit";
}

export default function UserForm({
  initialData,
  mode = "create",
}: UserFormProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: initialData?.name ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    role: (initialData?.role ?? "Temple Admin") as UserRole,
    active: initialData?.active ?? true,
  });

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);

    try {
      if (mode === "edit" && initialData?.id) {
        await userService.updateUser(initialData.id, form);
      } else {
        await userService.addUser(form);
      }

      router.push("/admin/users");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Unable to save user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl bg-white p-8 shadow"
    >
      <div>
        <Label>Name</Label>

        <Input
          value={form.name}
          onChange={(e) =>
            setForm({
              ...form,
              name: e.target.value,
            })
          }
        />
      </div>

      <div>
        <Label>Email</Label>

        <Input
          type="email"
          value={form.email}
          onChange={(e) =>
            setForm({
              ...form,
              email: e.target.value,
            })
          }
        />
      </div>

      <div>
        <Label>Phone</Label>

        <Input
          value={form.phone}
          onChange={(e) =>
            setForm({
              ...form,
              phone: e.target.value,
            })
          }
        />
      </div>

      <div>
        <Label>Role</Label>

        <select
          className="w-full rounded-md border p-3"
          value={form.role}
          onChange={(e) =>
            setForm({
              ...form,
              role: e.target.value as UserRole,
            })
          }
        >
          <option>Super Admin</option>
          <option>Temple Admin</option>
          <option>Billing</option>
          <option>Priest</option>
          <option>Office Staff</option>
          <option>Volunteer</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) =>
            setForm({
              ...form,
              active: e.target.checked,
            })
          }
        />

        <Label>Active User</Label>
      </div>

      <Button
        type="submit"
        disabled={loading}
      >
        {loading
          ? "Saving..."
          : mode === "edit"
          ? "Update User"
          : "Save User"}
      </Button>
    </form>
  );
}
