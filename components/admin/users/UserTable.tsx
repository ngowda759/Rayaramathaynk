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
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full min-w-[600px]">
        <thead className="bg-stone-100">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">Name</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">Email</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">Role</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-stone-700">Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center text-stone-500"
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
                <td className="px-4 py-3 text-sm font-medium">
                  {user.name}
                </td>

                <td className="px-4 py-3 text-sm text-stone-600">
                  {user.email}
                </td>

                <td className="px-4 py-3">
                  <UserRoleBadge role={user.role} />
                </td>

                <td className="px-4 py-3">
                  {user.active ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      Inactive
                    </span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/users/${user.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-1 text-xs text-orange-700 hover:bg-orange-200"
                    >
                      <Pencil className="h-3 w-3" />
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
