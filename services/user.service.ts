import { apiFetch } from "@/lib/api/fetch";
import { TempleUser, TempleUserCreate, TempleUserUpdate } from "@/types/user";

/**
 * Temple users (admin/staff directory), stored in Supabase `users`.
 *
 * `users` is deny-all under RLS and carries the role and activation state used for
 * authorization, so the browser never reads it directly: every call goes through the
 * admin-guarded `/api/admin/users` routes, which use the service role server-side.
 * There is no Firestore path. Note: this manages the directory row, not Firebase
 * Authentication — the login provider is unchanged.
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

  async addUser(user: TempleUserCreate): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/admin/users", { method: "POST", body: user });
    return id;
  }

  async updateUser(id: string, user: TempleUserUpdate): Promise<void> {
    await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PUT", body: user });
  }

  async deleteUser(id: string): Promise<void> {
    await apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

export const userService = new UserService();
