"use client";

/**
 * CalendarButton Component
 * Add to calendar functionality with multiple provider support
 */

import { useState } from "react";
import { useAddToCalendar } from "@/lib/device/hooks";
import { Calendar, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CalendarButtonProps {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  url?: string;
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "icon-sm";
  showLabel?: boolean;
  className?: string;
  modal?: boolean;
}

export function CalendarButton({
  title,
  description,
  location,
  startDate,
  endDate,
  allDay = false,
  url,
  variant = "outline",
  size = "sm",
  showLabel = true,
  className = "",
  modal = false,
}: CalendarButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const addToCalendar = useAddToCalendar({
    title,
    description,
    location,
    startDate,
    endDate,
    allDay,
    url,
  });

  const handleClick = () => {
    if (modal) {
      setShowModal(true);
    } else {
      // Default: Add to Google Calendar
      addToCalendar.addToGoogleCalendar();
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
      >
        <Calendar className="mr-2 h-4 w-4" />
        {showLabel && (size !== "icon") && "Add to Calendar"}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              Add to Calendar
            </DialogTitle>
            <DialogDescription>
              Choose a calendar to add this event
            </DialogDescription>
          </DialogHeader>

          {/* Event Preview */}
          <div className="bg-stone-50 rounded-lg p-4 mb-4">
            <p className="font-medium text-stone-800">{title}</p>
            <p className="text-sm text-stone-600 mt-1">
              {startDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {!allDay && (
                <>
                  {" at "}
                  {startDate.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </>
              )}
            </p>
            {location && (
              <p className="text-sm text-stone-500 mt-1">{location}</p>
            )}
          </div>

          {/* Calendar Options */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                addToCalendar.addToGoogleCalendar();
                setShowModal(false);
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center">
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
                  />
                </svg>
              </div>
              <span className="text-sm font-medium">Google</span>
            </button>

            <button
              onClick={() => {
                addToCalendar.addToAppleCalendar();
                setShowModal(false);
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-stone-900 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium">Apple</span>
            </button>

            <button
              onClick={() => {
                addToCalendar.addToOutlook();
                setShowModal(false);
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M7.88 12.04q0-.45.11-.87.12-.42.34-.78.22-.35.54-.6.32-.26.75-.4.44-.15.97-.15.56 0 1 .15.44.15.76.4.32.25.54.6.22.35.33.78.12.42.12.87t-.12.87q-.12.43-.33.79-.22.35-.54.6-.32.26-.76.4-.44.15-1 .15-.53 0-.97-.15-.43-.14-.75-.4-.42-.25-.54-.6-.22-.36-.34-.79-.11-.42-.11-.87zm.86-7.98q-.27.26-.39.63-.12.37-.12.8 0 .43.12.8.12.37.39.64.26.27.63.39.36.12.79.12t.8-.12q.36-.12.63-.39.27-.27.39-.64.12-.37.12-.8 0-.43-.12-.8-.12-.37-.39-.63-.27-.27-.63-.39-.37-.12-.8-.12t-.8.12q-.37.12-.63.39zm5.94 7.84v1.1h4.5v-1.1zm.01 2.89l.14.08q.2.14.52.3.32.15.78.3.46.14 1.11.24.65.1 1.5.1 1.35 0 2.27-.3.93-.3 1.55-.8.63-.5.95-1.15.32-.65.32-1.4 0-.54-.16-1.02-.15-.48-.45-.86-.3-.38-.74-.65-.44-.27-1-.44-.56-.17-1.22-.27-.65-.1-1.35-.1h-3.6v5.97zm1.15-5.16q.43.15 1.04.25.61.1 1.31.1.63 0 1.14-.07.5-.07.9-.22.39-.15.62-.4.22-.25.22-.62 0-.43-.3-.68-.3-.25-.87-.25h-3.2v2.89z"
                  />
                </svg>
              </div>
              <span className="text-sm font-medium">Outlook</span>
            </button>

            <button
              onClick={() => {
                addToCalendar.downloadICS();
                setShowModal(false);
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center">
                <Download className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium">.ICS File</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Simple Calendar Button - Just adds to Google Calendar
 */
export function SimpleCalendarButton(props: Omit<CalendarButtonProps, "modal">) {
  return <CalendarButton {...props} modal={false} />;
}
