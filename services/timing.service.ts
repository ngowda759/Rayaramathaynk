import { TempleTiming, TimingRequest } from "@/types/timing";

import { timingsRepository } from "@/repositories";

class TimingService {
  async getTimings(): Promise<TempleTiming[]> {
    return timingsRepository.getAll();
  }

  async getTimingById(id: string): Promise<TempleTiming | null> {
    return timingsRepository.getById(id);
  }

  async createTiming(data: TimingRequest): Promise<string> {
    const result = await timingsRepository.create(data);
    return result.id;
  }

  async updateTiming(
    id: string,
    data: Partial<TimingRequest>
  ): Promise<void> {
    await timingsRepository.update(id, data);
  }

  async deleteTiming(id: string): Promise<void> {
    await timingsRepository.delete(id);
  }
}

export const timingService = new TimingService();
