import { Seva, SevaRequest } from "@/types/seva";

import { sevasRepository } from "@/repositories";

class SevaService {
  async getAllSevas(): Promise<Seva[]> {
    return sevasRepository.getAll();
  }

  async getSevaById(id: string): Promise<Seva | null> {
    return sevasRepository.getById(id);
  }

  async createSeva(data: SevaRequest) {
    return sevasRepository.create(data);
  }

  async updateSeva(
    id: string,
    data: Partial<SevaRequest>
  ) {
    return sevasRepository.update(id, data);
  }

  async deleteSeva(id: string) {
    return sevasRepository.delete(id);
  }
}

export const sevaService = new SevaService();
