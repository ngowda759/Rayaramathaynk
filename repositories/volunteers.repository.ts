/**
 * Repository for managing volunteers and members.
 * This repository provides CRUD operations for volunteers/members using JSON storage.
 */

import { Member, MemberRequest, Volunteer, VolunteerRequest } from "@/types/volunteer";
import { readJson, writeJson, generateId } from "@/lib/storage";

const MEMBERS_FILE = "members.json";
const VOLUNTEERS_FILE = "volunteers.json";

interface MembersData {
  items: Member[];
}

interface VolunteersData {
  items: Volunteer[];
}

export const membersRepository = {
  /**
   * Get all members, sorted by creation date (newest first)
   */
  async getAll(): Promise<Member[]> {
    const data = await readJson<MembersData>(MEMBERS_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  },

  /**
   * Get member by ID
   */
  async getById(id: string): Promise<Member | null> {
    const data = await readJson<MembersData>(MEMBERS_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new member
   */
  async create(member: MemberRequest): Promise<Member> {
    const data = await readJson<MembersData>(MEMBERS_FILE) || { items: [] };
    const now = new Date().toISOString();

    const newMember: Member = {
      ...member,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    data.items.push(newMember);
    await writeJson(MEMBERS_FILE, data);

    return newMember;
  },

  /**
   * Update an existing member
   */
  async update(
    id: string,
    updates: Partial<MemberRequest>
  ): Promise<Member | null> {
    const data = await readJson<MembersData>(MEMBERS_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: Member = {
      ...data.items[index],
      ...updates,
      id: data.items[index].id,
      createdAt: data.items[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    data.items[index] = updated;
    await writeJson(MEMBERS_FILE, data);

    return updated;
  },

  /**
   * Delete a member
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<MembersData>(MEMBERS_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(MEMBERS_FILE, data);
    return true;
  },

  /**
   * Get the count of all members
   */
  async count(): Promise<number> {
    const data = await readJson<MembersData>(MEMBERS_FILE);
    return data?.items.length || 0;
  },
};

export const volunteersRepository = {
  /**
   * Get all volunteers, sorted by creation date (newest first)
   */
  async getAll(): Promise<Volunteer[]> {
    const data = await readJson<VolunteersData>(VOLUNTEERS_FILE);
    if (!data) return [];

    return [...data.items].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  },

  /**
   * Get volunteer by ID
   */
  async getById(id: string): Promise<Volunteer | null> {
    const data = await readJson<VolunteersData>(VOLUNTEERS_FILE);
    if (!data) return null;

    return data.items.find((item) => item.id === id) || null;
  },

  /**
   * Create a new volunteer
   */
  async create(volunteer: VolunteerRequest): Promise<Volunteer> {
    const data = await readJson<VolunteersData>(VOLUNTEERS_FILE) || { items: [] };
    const now = new Date().toISOString();

    const newVolunteer: Volunteer = {
      ...volunteer,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    data.items.push(newVolunteer);
    await writeJson(VOLUNTEERS_FILE, data);

    return newVolunteer;
  },

  /**
   * Update an existing volunteer
   */
  async update(
    id: string,
    updates: Partial<VolunteerRequest>
  ): Promise<Volunteer | null> {
    const data = await readJson<VolunteersData>(VOLUNTEERS_FILE);
    if (!data) return null;

    const index = data.items.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated: Volunteer = {
      ...data.items[index],
      ...updates,
      id: data.items[index].id,
      createdAt: data.items[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    data.items[index] = updated;
    await writeJson(VOLUNTEERS_FILE, data);

    return updated;
  },

  /**
   * Delete a volunteer
   */
  async delete(id: string): Promise<boolean> {
    const data = await readJson<VolunteersData>(VOLUNTEERS_FILE);
    if (!data) return false;

    const initialLength = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);

    if (data.items.length === initialLength) return false;

    await writeJson(VOLUNTEERS_FILE, data);
    return true;
  },

  /**
   * Get the count of all volunteers
   */
  async count(): Promise<number> {
    const data = await readJson<VolunteersData>(VOLUNTEERS_FILE);
    return data?.items.length || 0;
  },
};
