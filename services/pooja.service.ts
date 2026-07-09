import { DailyPooja, PoojaStats } from "@/types/pooja";

import { poojasRepository } from "@/repositories";

export const poojaService = {
  async getPoojas(): Promise<DailyPooja[]> {
    return poojasRepository.getAll();
  },

  async getPoojaById(id: string): Promise<DailyPooja | null> {
    return poojasRepository.getById(id);
  },

  async createPooja(
    data: Omit<DailyPooja, "id" | "createdAt" | "createdBy">,
    userEmail: string
  ): Promise<string> {
    const result = await poojasRepository.create({
      ...data,
      createdBy: userEmail,
    });
    return result.id;
  },

  async updatePooja(
    id: string,
    data: Partial<Omit<DailyPooja, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    await poojasRepository.update(id, data);
  },

  async deletePooja(id: string): Promise<void> {
    await poojasRepository.delete(id);
  },

  async getStats(): Promise<PoojaStats> {
    const poojas = await this.getPoojas();
    const byCategory: Record<string, number> = {};
    poojas.forEach((p) => {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    });
    return {
      total: poojas.length,
      active: poojas.filter((p) => p.isActive).length,
      byCategory,
      withSeva: poojas.filter((p) => p.sevaAmount > 0).length,
    };
  },
};
