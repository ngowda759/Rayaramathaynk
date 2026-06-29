import { Seva } from "@/types/sevaCatalog";

export const sevaCatalogService = {
  async getAll(): Promise<Seva[]> {
    return [];
  },

  async create(data: Omit<Seva, "id">) {},

  async update(id: string, data: Partial<Seva>) {},

  async delete(id: string) {},
};
