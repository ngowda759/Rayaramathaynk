// Note: Timestamp from firebase/firestore is no longer imported here
// Dates are stored as ISO strings for JSON compatibility
// This makes it easy to migrate to SQL later

export type EventStatus =
  | "Upcoming"
  | "Ongoing"
  | "Completed";

export interface TempleEvent {
  id?: string;

  title: string;

  description: string;

  location: string;

  // Event Dates - stored as ISO strings for JSON compatibility
  startDate: string | Date;
  endDate: string | Date;

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

  createdAt?: string | Date;
  updatedAt?: string | Date;
}
