"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import AdminPageHeader from "@/components/admin/common/AdminPageHeader";
import SearchBox from "@/components/admin/common/SearchBox";
import UserStats from "@/components/admin/users/UserStats";
import UserTable from "@/components/admin/users/UserTable";
import AdminAuthGuard from "@/components/admin/layout/AdminAuthGuard";

import { TempleUser } from "@/types/user";
import { userService } from "@/services/user.service";

function UsersPageContent() {
  const [users, setUsers] = useState<TempleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await userService.getUsers();
        console.log("Users:", data);
        setUsers(data);
      } catch (error) {
        console.error("Failed to load users:", error);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.toLowerCase();

    return users.filter((user) => {
      const name = user.name ?? "";
      const email = user.email ?? "";
      const role = user.role ?? "";

      return (
        name.toLowerCase().includes(keyword) ||
        email.toLowerCase().includes(keyword) ||
        role.toLowerCase().includes(keyword)
      );
    });
  }, [users, search]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Temple Users"
        description="Manage temple staff and administrator accounts."
        action={
          <Link href="/admin/users/new">
            <Button className="bg-orange-600 hover:bg-orange-700">
              Add User
            </Button>
          </Link>
        }
      />

      <UserStats
        total={users.length}
        active={users.filter((u) => u.isActive).length}
        admins={
          users.filter(
            (u) =>
              u.role === "Temple Admin" ||
              u.role === "Super Admin"
          ).length
        }
        volunteers={
          users.filter((u) => u.role === "Volunteer").length
        }
      />

      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search users..."
      />

      {loading ? (
        <div className="rounded-xl border bg-white p-8">
          Loading users...
        </div>
      ) : (
        <UserTable users={filteredUsers} />
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <AdminAuthGuard requiredPermission="users">
      <UsersPageContent />
    </AdminAuthGuard>
  );
}
