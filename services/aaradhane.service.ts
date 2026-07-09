import { Aaradhane, AaradhaneStats } from "@/types/aaradhane";

import { aaradhanesRepository } from "@/repositories";

export const aaradhaneService = {
  async getAaradhanes(): Promise<Aaradhane[]> {
    return aaradhanesRepository.getAll();
  },

  async getAaradhaneById(id: string): Promise<Aaradhane | null> {
    return aaradhanesRepository.getById(id);
  },

  async createAaradhane(
    data: Omit<Aaradhane, "id" | "createdAt" | "createdBy">,
    userEmail: string
  ): Promise<string> {
    const result = await aaradhanesRepository.create({
      ...data,
      createdBy: userEmail,
    });
    return result.id;
  },

  async updateAaradhane(
    id: string,
    data: Partial<Omit<Aaradhane, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    await aaradhanesRepository.update(id, data);
  },

  async deleteAaradhane(id: string): Promise<void> {
    await aaradhanesRepository.delete(id);
  },

  async getStats(): Promise<AaradhaneStats> {
    return aaradhanesRepository.getStats();
  },
};
