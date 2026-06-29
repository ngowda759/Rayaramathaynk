import { DashboardStats } from "@/types/dashboard";

export async function getDashboardStats(): Promise<DashboardStats> {
  return {
    donationsToday: 0,
    upcomingEvents: 0,
    registeredUsers: 0,
    galleryImages: 0,
  };
}
