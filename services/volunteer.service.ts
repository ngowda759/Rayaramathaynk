import { apiFetch } from "@/lib/api/fetch";
import { Member, MemberRequest, Volunteer, VolunteerRequest } from "@/types/volunteer";

/**
 * Members and volunteers, stored in Supabase `members` / `volunteers`.
 *
 * Both tables are deny-all under RLS, so the browser never reads them directly: every
 * call goes through the admin-guarded `/api/admin/members` and `/api/admin/volunteers`
 * routes, which use the service role server-side. There is no Firestore path.
 */

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) search.set(k, v);
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const memberService = {
  async getAllMembers(): Promise<Member[]> {
    return apiFetch<Member[]>("/api/admin/members");
  },
  async getMemberById(id: string): Promise<Member | null> {
    try {
      return await apiFetch<Member>(`/api/admin/members/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  },
  async createMember(data: MemberRequest): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/admin/members", { method: "POST", body: data });
    return id;
  },
  async updateMember(id: string, data: Partial<MemberRequest>): Promise<void> {
    await apiFetch(`/api/admin/members/${encodeURIComponent(id)}`, { method: "PUT", body: data });
  },
  async deleteMember(id: string): Promise<void> {
    await apiFetch(`/api/admin/members/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

export const volunteerService = {
  async getAllVolunteers(): Promise<Volunteer[]> {
    return apiFetch<Volunteer[]>("/api/admin/volunteers");
  },
  async getVolunteerById(id: string): Promise<Volunteer | null> {
    try {
      return await apiFetch<Volunteer>(`/api/admin/volunteers/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  },
  async createVolunteer(data: VolunteerRequest): Promise<string> {
    const { id } = await apiFetch<{ id: string }>("/api/admin/volunteers", { method: "POST", body: data });
    return id;
  },
  async updateVolunteer(id: string, data: Partial<VolunteerRequest>): Promise<void> {
    await apiFetch(`/api/admin/volunteers/${encodeURIComponent(id)}`, { method: "PUT", body: data });
  },
  async deleteVolunteer(id: string): Promise<void> {
    await apiFetch(`/api/admin/volunteers/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

void qs;
