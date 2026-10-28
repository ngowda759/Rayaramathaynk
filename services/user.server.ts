import "server-only";
import { rowIdFilter } from "@/lib/supabase/identifier";

import { createAdminClient } from "@/lib/supabase/admin";
import { TempleUser, TempleUserCreate, TempleUserUpdate } from "@/types/user";

const TABLE = "users";

/**
 * Temple users (admin/staff directory), stored in Supabase `users`.
 *
 * The service-role client is used for every operation: `users` is deny-all under RLS
 * and carries role and activation state used for authorization. There is no Firestore
 * path. Note: this manages the directory row, not Firebase Authentication — the login
 * provider is unchanged.
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

  async addUser(user: TempleUserCreate) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        display_name: user.name,
        email: user.email,
        phone_number: user.phone,
        role: user.role,
        active: user.active,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create user: ${error.message}`);
    return data.firestore_id || data.id;
  }

  async updateUser(id: string, user: TempleUserUpdate) {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (user.name !== undefined) update.display_name = user.name;
    if (user.email !== undefined) update.email = user.email;
    if (user.phone !== undefined) update.phone_number = user.phone;
    if (user.role !== undefined) update.role = user.role;
    if (user.active !== undefined) update.active = user.active;
    update.updated_at = new Date().toISOString();
    const { error } = await supabase.from(TABLE).update(update).or(rowIdFilter(id));
    if (error) throw new Error(`Could not update user: ${error.message}`);
  }

  async deleteUser(id: string) {
    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE).delete().or(rowIdFilter(id));
    if (error) throw new Error(`Could not delete user: ${error.message}`);
  }
}

export const userService = new UserService();
