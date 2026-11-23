import "server-only";
import { rowIdFilter } from "@/lib/supabase/identifier";

import { createAdminClient } from "@/lib/supabase/admin";
import { TempleUser } from "@/types/user";

const TABLE = "users";

/**
 * Temple users (admin/staff directory), stored in Supabase `users`.
 *
 * Read-only (AUTHZ-01). The service-role client is used for every read: `users` is deny-all
 * under RLS and carries role and activation state used for authorization. Role and status
 * writes live in the staff module (`lib/seva/server/staff.ts`), which enforces the DB §3.3
 * matrix and audits the change. There is no Firestore path.
 */
function rowToUser(row: any): TempleUser {
  const isActive = row.active ?? true;
  return {
    id: row.firestore_id || row.id,
    name: row.display_name ?? "",
    email: row.email ?? "",
    phone: row.phone_number ?? "",
    role: row.role ?? "Volunteer",
    active: isActive,
    isActive,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class UserService {
  async getUsers(): Promise<TempleUser[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from(TABLE).select("*");
    if (error) throw new Error(`Could not read users: ${error.message}`);
    return (data ?? []).map(rowToUser);
  }

  async getUser(id: string): Promise<TempleUser | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .or(rowIdFilter(id))
      .maybeSingle();
    if (error) throw new Error(`Could not read user: ${error.message}`);
    return data ? rowToUser(data) : null;
  }
}

export const userService = new UserService();
