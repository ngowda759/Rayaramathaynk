"use client";

import React from "react";
import Link from "next/link";
import { CalendarDays, Clock3, MapPin, ArrowRight, Share2, Calendar, Navigation, Bell, Loader2 } from "lucide-react";
import { TempleEvent } from "@/types/event";
import { useShare, useLocation, useNotifications } from "@/lib/device";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";

interface Props {
  event: TempleEvent;
}

function toDate(date: any): Date {
  if (!date) return new Date(0);
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  if (typeof date === 'number') return new Date(date);
  if (date.toDate && typeof date.toDate === 'function') return date.toDate();
  return new Date(0);
}

function daysLeft(date: Date) {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const eventDate = new Date(date);

  eventDate.setHours(0, 0, 0, 0);

  const diff =
    eventDate.getTime() - today.getTime();

  return Math.max(
    0,
    Math.ceil(diff / (1000 * 60 * 60 * 24))
  );
}

export default function EventCard({
  event,
}: Props) {
  const start = toDate(event.startDate);
  const share = useShare();
  const location = useLocation();
  const notifications = useNotifications();
  const [isSharing, setIsSharing] = React.useState(false);
  const [isNotify, setIsNotify] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const month = start
    .toLocaleString("en-US", {
      month: "short",
    })
    .toUpperCase();

  // Share event
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSharing(true);
    
    const dateStr = start.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    
    const success = await share.share({
      title: event.title,
      text: `Join us for ${event.title} on ${dateStr}${event.startTime ? ` at ${event.startTime}` : ""} at ${event.location}`,
      url: typeof window !== "undefined" ? `${window.location.origin}/events/${event.id}` : "",
    });
    
    setIsSharing(false);
    if (success) {
      toast.success("Event has been shared");
    }
  };

  // Add to calendar
  const handleAddToCalendar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const eventUrl = typeof window !== "undefined" ? `${window.location.origin}/events/${event.id}` : "";
    
    // Open Google Calendar
    const startDate = start.toISOString().replace(/-|:|\.\d+/g, "").slice(0, 15) + "Z";
    const endDate = new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d+/g, "").slice(0, 15) + "Z";
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(event.description || "")}&location=${encodeURIComponent(event.location || "")}`;
    
    window.open(calendarUrl, "_blank");
    toast.success("Adding event to your calendar");
  };

  // Get directions
  const handleGetDirections = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    location.openNavigation();
  };

  // Set notification reminder
  const handleNotify = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    
    try {
      if (!notifications.isGranted) {
        const permission = await notifications.requestPermission();
        if (permission !== "granted") {
          toast.error("Please enable notifications to set reminders");
          setIsLoading(false);
          return;
        }
      }

      const notificationId = `event-${event.id}`;
      notifications.scheduleEventReminder(
        notificationId,
        event.title,
        start,
        30 // 30 minutes before
      );

      setIsNotify(true);
      toast.success(`Reminder set for ${event.title}`);
    } catch {
      toast.error("Failed to set reminder");
    }
    
    setIsLoading(false);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-lg transition hover:-translate-y-2 hover:shadow-2xl">

      <div className="bg-gradient-to-r from-amber-600 to-orange-500 p-4 text-white">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-xs uppercase tracking-widest">
              {month}
            </p>

            <h3 className="mt-1 text-2xl font-bold">
              {start.getDate()}
            </h3>

          </div>

          <CalendarDays size={28} />

        </div>

      </div>

      <div className="p-4">

        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          {daysLeft(start)} Days Left
        </span>

        <h3 className="mt-4 text-lg font-bold">
          {event.title}
        </h3>

        <p className="mt-3 line-clamp-2 text-sm leading-5 text-stone-600">
          {event.description}
        </p>

        <div className="mt-4 space-y-2">

          {event.startTime && (
            <div className="flex items-center gap-2 text-sm">
              <Clock3
                className="text-amber-600"
                size={14}
              />
              {event.startTime}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <MapPin
              className="text-amber-600"
              size={14}
            />
            {event.location}
          </div>

        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            disabled={isSharing}
            className="flex-1 gap-1"
          >
            {isSharing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Share2 className="h-3 w-3" />
            )}
            Share
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddToCalendar}
            className="flex-1 gap-1"
          >
            <Calendar className="h-3 w-3" />
            Calendar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNotify}
            disabled={isLoading}
            className={`flex-1 gap-1 ${isNotify ? "border-green-300 bg-green-50" : ""}`}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Bell className={`h-3 w-3 ${isNotify ? "text-green-600" : ""}`} />
            )}
            {isNotify ? "Notified" : "Notify"}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleGetDirections}
            className="flex-1 gap-1"
          >
            <Navigation className="h-3 w-3" />
            Directions
          </Button>
        </div>

        <Link
          href={`/events/${event.id}`}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:scale-105"
        >
          View Event
          <ArrowRight size={14} />
        </Link>

      </div>

    </div>
  );
}
