import { TempleEvent, EventStatus } from "@/types/event";

/**
 * Converts a date value (string or Date) to a Date object
 */
function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  try {
    return new Date(value);
  } catch {
    return null;
  }
}

/**
 * Returns the current status of an event
 * based on today's date.
 *
 * Null-safe: if startDate or endDate is missing/null
 * (e.g. legacy or malformed data), falls back
 * to "Upcoming" instead of throwing.
 */
export function getEventStatus(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined
): EventStatus {
  const start = toDate(startDate);
  const end = toDate(endDate);

  if (!start || !end) {
    return "Upcoming";
  }

  const today = new Date();

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
export function getDaysLeft(startDate: string | Date | null | undefined): number {
  const start = toDate(startDate);

  if (!start) {
    return 0;
  }

  const today = new Date();

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
    const aDate = toDate(a.startDate);
    const bDate = toDate(b.startDate);
    const aTime = aDate?.getTime() ?? 0;
    const bTime = bDate?.getTime() ?? 0;
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
