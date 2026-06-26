import { Timestamp } from "firebase/firestore";

export type EventStatus = "Upcoming" | "Ongoing" | "Completed";

export interface TempleEvent {
  id?: string;

  title: string;

  description: string;

  location: string;

  imageUrl?: string;

  startDate: Timestamp;

  endDate: Timestamp;

  featured: boolean;

  status: EventStatus;

  createdAt?: Timestamp;

  updatedAt?: Timestamp;
}
