import { TempleUser } from "@/types/user";
import UserRoleBadge from "./UserRoleBadge";

interface UserTableProps {
  users: TempleUser[];
}

/**
 * Read-only account list (AUTHZ-01). Role and status changes live in the Staff and roles
 * tab, which calls the staff module; this table must not offer edit or delete controls.
 */
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
          </tr>
        </thead>

        <tbody>
          {users.length === 0 ? (
            <tr>
              <td
                colSpan={4}
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
