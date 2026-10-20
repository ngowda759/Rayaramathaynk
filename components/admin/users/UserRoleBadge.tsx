import { UserRole } from "@/types/user";
import { STAFF_ROLE_LABEL } from "@/lib/seva/strings/staff";

interface Props {
  role: UserRole;
}

const colors: Record<UserRole, string> = {
  "Super Admin": "bg-red-100 text-red-700",
  "Temple Admin": "bg-orange-100 text-orange-700",
  Priest: "bg-blue-100 text-blue-700",
  "Office Staff": "bg-green-100 text-green-700",
  Volunteer: "bg-purple-100 text-purple-700",
  super_admin: "bg-red-100 text-red-700",
  temple_admin: "bg-orange-100 text-orange-700",
  priest: "bg-blue-100 text-blue-700",
  staff: "bg-green-100 text-green-700",
  volunteer: "bg-purple-100 text-purple-700",
  devotee: "bg-slate-100 text-slate-700",
  Billing: "bg-violet-100 text-violet-700",
  billing: "bg-violet-100 text-violet-700",
  receptionist: "bg-teal-100 text-teal-700",
  prasadam_counter: "bg-amber-100 text-amber-700",
};

/** The four seva roles read as words (DB §3.1); every other stored role shows as it always did. */
const labels: Partial<Record<UserRole, string>> = {
  receptionist: STAFF_ROLE_LABEL.receptionist.en,
  prasadam_counter: STAFF_ROLE_LABEL.prasadam_counter.en,
  temple_admin: STAFF_ROLE_LABEL.temple_admin.en,
  super_admin: STAFF_ROLE_LABEL.super_admin.en,
};

export default function UserRoleBadge({ role }: Props) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[role]}`}
    >
      {labels[role] ?? role}
    </span>
  );
}
