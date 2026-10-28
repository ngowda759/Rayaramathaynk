"use client";

import { useState, useEffect } from "react";

import { useAdminFetch } from "@/hooks/useAdminFetch";

interface DonationNotification {
  id: string;
  donorName: string;
  amount: number;
  purpose: string;
  paymentMode: string;
  createdAt: Date;
}

interface RecentDonationRow {
  id: string;
  donorName?: string;
  amount?: number;
  purpose?: string;
  paymentMode?: string;
  createdAt?: string;
}

/**
 * Recent donation notifications for the admin header dropdown.
 *
 * Reads `/api/admin/donations/recent`, which is guarded by `requireAdminUser` and reads
 * Supabase `donations` with the service-role client. There is no Firestore listener. A
 * failed read leaves the list empty rather than falling back to Firestore.
 */
export function useDonationNotifications() {
  const adminFetch = useAdminFetch();
  const [notifications, setNotifications] = useState<DonationNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDonations() {
      try {
        setLoading(true);
        setError(null);

        const response = await adminFetch("/api/admin/donations/recent");
        if (!response.ok) throw new Error(`Failed to load donations (${response.status})`);
        const { data } = (await response.json()) as { data: RecentDonationRow[] };

        const donations: DonationNotification[] = (data ?? []).map((row) => ({
          id: row.id,
          donorName: row.donorName || "Anonymous",
          amount: row.amount || 0,
          purpose: row.purpose || "General Donation",
          paymentMode: row.paymentMode || "unknown",
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        }));

        if (cancelled) return;
        setNotifications(donations);
        setUnreadCount(donations.length);
      } catch (err: any) {
        console.log("Donation notifications unavailable:", err?.message);
        if (!cancelled) {
          setError(null);
          setNotifications([]);
          setUnreadCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDonations();
    const interval = setInterval(fetchDonations, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [adminFetch]);

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  };
}
