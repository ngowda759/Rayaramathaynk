import Link from "next/link";
import { Pencil } from "lucide-react";

import { TempleUser } from "@/types/user";
import UserRoleBadge from "./UserRoleBadge";
import DeleteUserDialog from "./DeleteUserDialog";

interface UserTableProps {
  users: TempleUser[];
}

export default function UserTable({
  users,
}: UserTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-stone-100">
          <tr>
            <th className="px-6 py-4 text-left">Name</th>
            <th className="px-6 py-4 text-left">Email</th>
            <th className="px-6 py-4 text-left">Role</th>
            <th className="px-6 py-4 text-left">Status</th>
            <th className="px-6 py-4 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-6 py-10 text-center text-stone-500"
              >
                No users found.
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr
                key={user.id}
                className="border-t hover:bg-stone-50"
              >
                <td className="px-6 py-4 font-medium">
                  {user.name}
                </td>

                <td className="px-6 py-4">
                  {user.email}
                </td>

                <td className="px-6 py-4">
                  <UserRoleBadge role={user.role} />
                </td>

                <td className="px-6 py-4">
                  {user.active ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                      Inactive
                    </span>
                  )}
                </td>

                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/users/${user.id}/edit`}
                      className="inline-flex items-center gap-2 rounded-lg bg-orange-100 px-3 py-2 text-sm text-orange-700 hover:bg-orange-200"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>

                    {user.id && (
                      <DeleteUserDialog
                        id={user.id}
                        name={user.name}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
