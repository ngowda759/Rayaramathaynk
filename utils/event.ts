import { Timestamp } from "firebase/firestore";
import { TempleEvent, EventStatus } from "@/types/event";

// Define a type for date values that can come from various sources
type DateValue = Date | number | string | { toDate: () => Date } | Timestamp | null | undefined;

// Helper function to convert date to Date object
function toDate(date: DateValue): Date {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  if (typeof date === 'number') return new Date(date);
  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  if (date instanceof Timestamp) return date.toDate();
  return new Date(0);
}

// Helper function to get timestamp in milliseconds
function toMillis(date: DateValue): number {
  return toDate(date).getTime();
}

/**
 * Returns the current status of an event
 * based on today's date.
 *
 * Null-safe: if startDate or endDate is missing/null
 * (e.g. legacy or malformed Firestore docs), falls back
 * to "Upcoming" instead of throwing.
 */
export function getEventStatus(
  startDate: DateValue,
  endDate: DateValue
): EventStatus {
  if (!startDate || !endDate) {
    return "Upcoming";
  }

  const today = new Date();

  const start = toDate(startDate);
  const end = toDate(endDate);

  // Ignore time when comparing dates
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (today < start) {
    return "Upcoming";
  }

  if (today > end) {
    return "Completed";
  }

  return "Ongoing";
}

/**
 * Returns number of days remaining until event starts.
 *
 * Null-safe: returns 0 if startDate is missing/null.
 */
export function getDaysLeft(startDate: DateValue): number {
  if (!startDate) {
    return 0;
  }

  const today = new Date();
  const start = toDate(startDate);

  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  const diff = start.getTime() - today.getTime();

  return Math.max(
    0,
    Math.ceil(diff / (1000 * 60 * 60 * 24))
  );
}

/**
 * Returns events sorted by Start Date.
 *
 * Null-safe: events with a missing/null startDate are
 * treated as epoch (0) instead of throwing, so they sort
 * to the front rather than crashing the whole list.
 */
export function sortEventsByDate(
  events: TempleEvent[]
): TempleEvent[] {
  return [...events].sort((a, b) => {
    const aTime = toMillis(a.startDate);
    const bTime = toMillis(b.startDate);
    return aTime - bTime;
  });
}

/**
 * Returns only featured events.
 */
export function getFeaturedEvents(
  events: TempleEvent[]
): TempleEvent[] {
  return events.filter((event) => event.featured);
}

/**
 * Returns only upcoming events.
 */
export function getUpcomingEvents(
  events: TempleEvent[]
): TempleEvent[] {
  return sortEventsByDate(events).filter(
    (event) =>
      getEventStatus(event.startDate, event.endDate) ===
      "Upcoming"
  );
}

/**
 * Returns only ongoing events.
 */
export function getOngoingEvents(
  events: TempleEvent[]
): TempleEvent[] {
  return sortEventsByDate(events).filter(
    (event) =>
      getEventStatus(event.startDate, event.endDate) ===
      "Ongoing"
  );
}

/**
 * Returns only completed events.
 */
export function getCompletedEvents(
  events: TempleEvent[]
): TempleEvent[] {
  return sortEventsByDate(events).filter(
    (event) =>
      getEventStatus(event.startDate, event.endDate) ===
      "Completed"
  );
}
