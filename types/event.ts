import { Timestamp } from "firebase/firestore";

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
  startDate: Timestamp;
  endDate: Timestamp;

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

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
