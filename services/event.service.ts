import { TempleEvent } from "@/types/event";

import { eventsRepository } from "@/repositories";

class EventService {
  // ============================
  // Admin
  // ============================

  async getEvents(): Promise<TempleEvent[]> {
    return eventsRepository.getAll();
  }

  async getEvent(id: string): Promise<TempleEvent | null> {
    return eventsRepository.getById(id);
  }

  async addEvent(event: TempleEvent) {
    return eventsRepository.create(event);
  }

  async updateEvent(id: string, event: Partial<TempleEvent>) {
    return eventsRepository.update(id, event);
  }

  async deleteEvent(id: string) {
    return eventsRepository.delete(id);
  }

  // ============================
  // Public Website
  // ============================

  async getPublishedEvents(): Promise<TempleEvent[]> {
    return eventsRepository.getPublished();
  }

  async getUpcomingEvents(max = 3): Promise<TempleEvent[]> {
    return eventsRepository.getUpcoming(max);
  }

  async getPastEvents(): Promise<TempleEvent[]> {
    return eventsRepository.getPast();
  }

  async getFeaturedEvent(): Promise<TempleEvent | null> {
    return eventsRepository.getFeatured();
  }
}

export const eventService = new EventService();
