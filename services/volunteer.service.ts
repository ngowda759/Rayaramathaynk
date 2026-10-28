import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { Member, MemberRequest, Volunteer, VolunteerRequest } from "@/types/volunteer";

const MEMBERS_TABLE = "members";
const VOLUNTEERS_TABLE = "volunteers";

/**
 * Members and volunteers, stored in Supabase `members` / `volunteers`.
 *
 * Reads use the public client; writes use the service-role admin client because both
 * tables are deny-all under RLS. There is no Firestore path: a read failure throws
 * rather than returning an empty list that hides the failure.
 */

function rowToMember(row: any): Member {
  return {
    id: row.firestore_id || row.id,
    memberId: row.member_id || "",
    name: row.name || "",
    phone: row.phone || "",
    sex: row.sex || "Male",
    active: row.active ?? true,
    address: row.address || "",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function rowToVolunteer(row: any): Volunteer {
  return {
    id: row.firestore_id || row.id,
    volunteerId: row.volunteer_id || "",
    name: row.name || "",
    phone: row.phone || "",
    sex: row.sex || "Male",
    active: row.active ?? true,
    address: row.address || "",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export const memberService = {
  async getAllMembers(): Promise<Member[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(MEMBERS_TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not read members: ${error.message}`);
    return (data ?? []).map(rowToMember);
  },

  async getMemberById(id: string): Promise<Member | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(MEMBERS_TABLE)
      .select("*")
      .eq("firestore_id", id)
      .maybeSingle();
    if (error) throw new Error(`Could not read member: ${error.message}`);
    return data ? rowToMember(data) : null;
  },

  async createMember(data: MemberRequest): Promise<string> {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(MEMBERS_TABLE)
      .insert({
        member_id: data.memberId,
        name: data.name,
        phone: data.phone,
        sex: data.sex,
        active: data.active,
        address: data.address,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create member: ${error.message}`);
    return row.firestore_id || row.id;
  },

  async updateMember(id: string, data: Partial<MemberRequest>): Promise<void> {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (data.memberId !== undefined) update.member_id = data.memberId;
    if (data.name !== undefined) update.name = data.name;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.sex !== undefined) update.sex = data.sex;
    if (data.active !== undefined) update.active = data.active;
    if (data.address !== undefined) update.address = data.address;
    const { error } = await supabase.from(MEMBERS_TABLE).update(update).eq("firestore_id", id);
    if (error) throw new Error(`Could not update member: ${error.message}`);
  },

  async deleteMember(id: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(MEMBERS_TABLE).delete().eq("firestore_id", id);
    if (error) throw new Error(`Could not delete member: ${error.message}`);
  },
};

export const volunteerService = {
  async getAllVolunteers(): Promise<Volunteer[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(VOLUNTEERS_TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Could not read volunteers: ${error.message}`);
    return (data ?? []).map(rowToVolunteer);
  },

  async getVolunteerById(id: string): Promise<Volunteer | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(VOLUNTEERS_TABLE)
      .select("*")
      .eq("firestore_id", id)
      .maybeSingle();
    if (error) throw new Error(`Could not read volunteer: ${error.message}`);
    return data ? rowToVolunteer(data) : null;
  },

  async createVolunteer(data: VolunteerRequest): Promise<string> {
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from(VOLUNTEERS_TABLE)
      .insert({
        volunteer_id: data.volunteerId,
        name: data.name,
        phone: data.phone,
        sex: data.sex,
        active: data.active,
        address: data.address,
      })
      .select("firestore_id, id")
      .single();
    if (error) throw new Error(`Could not create volunteer: ${error.message}`);
    return row.firestore_id || row.id;
  },

  async updateVolunteer(id: string, data: Partial<VolunteerRequest>): Promise<void> {
    const supabase = createAdminClient();
    const update: Record<string, unknown> = {};
    if (data.volunteerId !== undefined) update.volunteer_id = data.volunteerId;
    if (data.name !== undefined) update.name = data.name;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.sex !== undefined) update.sex = data.sex;
    if (data.active !== undefined) update.active = data.active;
    if (data.address !== undefined) update.address = data.address;
    const { error } = await supabase.from(VOLUNTEERS_TABLE).update(update).eq("firestore_id", id);
    if (error) throw new Error(`Could not update volunteer: ${error.message}`);
  },

  async deleteVolunteer(id: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.from(VOLUNTEERS_TABLE).delete().eq("firestore_id", id);
    if (error) throw new Error(`Could not delete volunteer: ${error.message}`);
  },
};
