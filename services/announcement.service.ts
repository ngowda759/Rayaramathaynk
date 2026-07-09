import {
  Announcement,
  AnnouncementRequest,
} from "@/types/announcement";

import { announcementsRepository } from "@/repositories";

class AnnouncementService {
  async getAnnouncements(): Promise<Announcement[]> {
    return announcementsRepository.getAll();
  }

  async getActiveAnnouncements(): Promise<Announcement[]> {
    return announcementsRepository.getActive();
  }

  async addAnnouncement(announcement: AnnouncementRequest) {
    return announcementsRepository.create(announcement);
  }

  async updateAnnouncement(id: string, announcement: Partial<AnnouncementRequest>) {
    return announcementsRepository.update(id, announcement);
  }

  async deleteAnnouncement(id: string) {
    return announcementsRepository.delete(id);
  }

  async getAnnouncement(id: string) {
    return announcementsRepository.getById(id);
  }
}

export const announcementService = new AnnouncementService();
