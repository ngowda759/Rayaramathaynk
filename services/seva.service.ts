import { Seva } from "@/types/seva";

export const sevaCatalogService = {
  async getAll(): Promise<Seva[]> {
    return [];
  },

  async create(data: Omit<Seva, "id">) {},

  async update(id: string, data: Partial<Seva>) {},

  async delete(id: string) {},
};
