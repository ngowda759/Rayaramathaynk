import { Timestamp } from "firebase/firestore";
import { TempleEvent, EventStatus } from "@/types/event";

/**
 * Returns the current status of an event
 * based on today's date.
 *
 * Null-safe: if startDate or endDate is missing/null
 * (e.g. legacy or malformed Firestore docs), falls back
 * to "Upcoming" instead of throwing.
 */
export function getEventStatus(
  startDate: Timestamp | null | undefined,
  endDate: Timestamp | null | undefined
): EventStatus {
  if (!startDate || !endDate) {
    return "Upcoming";
  }

  const today = new Date();

  const start = startDate.toDate();
  const end = endDate.toDate();

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
export function getDaysLeft(startDate: Timestamp | null | undefined): number {
  if (!startDate) {
    return 0;
  }

  const today = new Date();
  const start = startDate.toDate();

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
    const aTime = a.startDate?.toMillis?.() ?? 0;
    const bTime = b.startDate?.toMillis?.() ?? 0;
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
