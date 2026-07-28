/**
 * Calendar Service
 * Add to calendar functionality for Google, Apple, Outlook, and ICS download
 */

import type { CalendarEvent, CalendarProvider } from "@/types/device";

class CalendarService {
  /**
   * Generate Google Calendar URL
   */
  generateGoogleCalendarUrl(event: CalendarEvent): string {
    const startDate = this.formatDateForGoogle(event.startDate);
    const endDate = this.formatDateForGoogle(event.endDate);
    
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title,
      dates: `${startDate}/${endDate}`,
      details: event.description || "",
      location: event.location || "",
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /**
   * Generate Apple Calendar URL (webcal)
   */
  generateAppleCalendarUrl(event: CalendarEvent): string {
    const startDate = this.formatDateForApple(event.startDate);
    const endDate = this.formatDateForApple(event.endDate);
    
    const icsContent = this.generateICS(event);
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    return URL.createObjectURL(blob);
  }

  /**
   * Generate Outlook URL
   */
  generateOutlookUrl(event: CalendarEvent): string {
    const startDate = this.formatDateForOutlook(event.startDate);
    const endDate = this.formatDateForOutlook(event.endDate);
    
    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: event.title,
      startdt: startDate,
      enddt: endDate,
      body: event.description || "",
      location: event.location || "",
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }

  /**
   * Generate ICS file content
   */
  generateICS(event: CalendarEvent): string {
    const startDate = this.formatDateForICS(event.startDate);
    const endDate = this.formatDateForICS(event.endDate);
    const now = this.formatDateForICS(new Date());
    const uid = `${Date.now()}-${this.generateSecureRandomString(9)}@rayaramathaynk`;

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sri Raghavendra Swamy Matha//Temple Portal//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${this.escapeICSText(event.title)}`,
      event.description ? `DESCRIPTION:${this.escapeICSText(event.description)}` : "",
      event.location ? `LOCATION:${this.escapeICSText(event.location)}` : "",
      event.url ? `URL:${event.url}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean);

    return ics.join("\r\n");
  }

  private generateSecureRandomString(length: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);

    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }

    return result;
  }

  /**
   * Download ICS file
   */
  downloadICS(event: CalendarEvent): void {
    const icsContent = this.generateICS(event);
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Add to calendar via provider
   */
  addToCalendar(provider: CalendarProvider, event: CalendarEvent): void {
    switch (provider) {
      case "google":
        window.open(this.generateGoogleCalendarUrl(event), "_blank");
        break;
      case "apple":
        this.downloadICS(event);
        break;
      case "outlook":
        window.open(this.generateOutlookUrl(event), "_blank");
        break;
      case "ics":
        this.downloadICS(event);
        break;
    }
  }

  /**
   * Show calendar options modal (for UI)
   */
  getCalendarOptions(event: CalendarEvent): Array<{
    provider: CalendarProvider;
    label: string;
    icon: string;
    action: () => void;
  }> {
    return [
      {
        provider: "google",
        label: "Google Calendar",
        icon: "📅",
        action: () => this.addToCalendar("google", event),
      },
      {
        provider: "apple",
        label: "Apple Calendar",
        icon: "🍎",
        action: () => this.addToCalendar("apple", event),
      },
      {
        provider: "outlook",
        label: "Outlook",
        icon: "📮",
        action: () => this.addToCalendar("outlook", event),
      },
      {
        provider: "ics",
        label: "Download .ics",
        icon: "📥",
        action: () => this.addToCalendar("ics", event),
      },
    ];
  }

  /**
   * Format date for Google Calendar
   */
  private formatDateForGoogle(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  /**
   * Format date for Apple Calendar (ICS)
   */
  private formatDateForApple(date: Date): string {
    return date.toISOString();
  }

  /**
   * Format date for Outlook
   */
  private formatDateForOutlook(date: Date): string {
    return date.toISOString();
  }

  /**
   * Format date for ICS
   */
  private formatDateForICS(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  /**
   * Escape special characters in ICS text
   */
  private escapeICSText(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  }
}

// Singleton instance
export const calendarService = new CalendarService();
