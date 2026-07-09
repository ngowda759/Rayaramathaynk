import { Member, MemberRequest, Volunteer, VolunteerRequest } from "@/types/volunteer";

import { membersRepository, volunteersRepository } from "@/repositories";

export const memberService = {
  async getAllMembers(): Promise<Member[]> {
    return membersRepository.getAll();
  },

  async getMemberById(id: string): Promise<Member | null> {
    return membersRepository.getById(id);
  },

  async createMember(data: MemberRequest): Promise<string> {
    const result = await membersRepository.create(data);
    return result.id;
  },

  async updateMember(id: string, data: Partial<MemberRequest>): Promise<void> {
    await membersRepository.update(id, data);
  },

  async deleteMember(id: string): Promise<void> {
    await membersRepository.delete(id);
  },
};

export const volunteerService = {
  async getAllVolunteers(): Promise<Volunteer[]> {
    return volunteersRepository.getAll();
  },

  async getVolunteerById(id: string): Promise<Volunteer | null> {
    return volunteersRepository.getById(id);
  },

  async createVolunteer(data: VolunteerRequest): Promise<string> {
    const result = await volunteersRepository.create(data);
    return result.id;
  },

  async updateVolunteer(id: string, data: Partial<VolunteerRequest>): Promise<void> {
    await volunteersRepository.update(id, data);
  },

  async deleteVolunteer(id: string): Promise<void> {
    await volunteersRepository.delete(id);
  },
};
