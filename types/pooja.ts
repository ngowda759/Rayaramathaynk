export interface DailyPooja {
  id: string;
  title: string;
  description: string;
  startTime: string;
  duration: string;
  category: PoojaCategory;
  sevaAmount: number;
  isActive: boolean;
  displayOrder: number;
  days: string[];
  notes: string;
  createdAt: string;
  createdBy: string;
}

export type PoojaCategory =
  | "Morning"
  | "Afternoon"
  | "Evening"
  | "Night"
  | "Special";

export const POOJA_CATEGORIES: PoojaCategory[] = [
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
  "Special",
];

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export interface PoojaStats {
  total: number;
  active: number;
  byCategory: Record<string, number>;
  withSeva: number;
}
