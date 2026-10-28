export type EventStatus =
  | "Upcoming"
  | "Ongoing"
  | "Completed";

export interface TempleEvent {
  id?: string;

  title: string;

  description: string;

  location: string;

  // Event Dates
  // ISO-8601 strings as stored in Supabase `events` (timestamp with time zone).
  startDate: string;
  endDate: string;

  // Event Time
  startTime?: string;
  endTime?: string;

  // Homepage
  featured: boolean;
  published: boolean;

  // Classification
  category?: string;

  // Media
  imageUrl?: string;

  // Legacy (will be removed later)
  status: EventStatus;

  createdAt?: string;
  updatedAt?: string;
}
