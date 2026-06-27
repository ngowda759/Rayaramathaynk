"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import UserForm from "@/components/admin/users/UserForm";
import { userService } from "@/services/user.service";
import { TempleUser } from "@/types/user";

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();

  const [user, setUser] = useState<TempleUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await userService.getUser(id);

        if (data) {
          setUser(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [id]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-8">
        Loading user...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border bg-white p-8">
        User not found.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">
        Edit User
      </h1>

      <UserForm
        mode="edit"
        initialData={user}
      />
    </div>
  );
}
