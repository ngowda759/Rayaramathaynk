"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Heart, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDonationNotifications } from "@/hooks/useDonationNotifications";

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useDonationNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold text-stone-900">Donation Alerts</h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-amber-600 hover:text-amber-700"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-stone-500">
                <Heart className="mx-auto h-8 w-8 text-stone-300" />
                <p className="mt-2 text-sm">No recent donations</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex gap-3 border-b px-4 py-3 hover:bg-stone-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <Heart className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900">
                      New Donation
                    </p>
                    <p className="text-sm text-stone-600 truncate">
                      {notification.donorName} donated ₹{notification.amount}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
                      <span>{notification.purpose || "General"}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(notification.createdAt, { addSuffix: true })}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notification.id);
                    }}
                    className="shrink-0 text-stone-400 hover:text-stone-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t p-3">
            <a
              href="/admin/donations"
              className="block w-full rounded-lg bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-amber-700"
              onClick={() => setIsOpen(false)}
            >
              View All Donations
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
