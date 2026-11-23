import { apiFetch } from "@/lib/api/fetch";
import { TempleUser } from "@/types/user";

/**
 * Temple users (admin/staff directory), stored in Supabase `users`.
 *
 * Read-only (AUTHZ-01). `users` is deny-all under RLS and carries the role and activation
 * state used for authorization, so the browser never reads it directly: every read goes
 * through the admin-guarded `/api/admin/users` route, which uses the service role
 * server-side. Role and status changes go through the staff module's API
 * (`services/seva/staff.service`), which enforces the permission matrix and audits the
 * change. There is no Firestore path.
 */
class UserService {
  async getUsers(): Promise<TempleUser[]> {
    return apiFetch<TempleUser[]>("/api/admin/users");
  }

  async getUser(id: string): Promise<TempleUser | null> {
    try {
      return await apiFetch<TempleUser>(`/api/admin/users/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  }
}

export const userService = new UserService();
