"use client";

import { useState, useEffect } from "react";

interface DonationNotification {
  id: string;
  donorName: string;
  amount: number;
  purpose: string;
  paymentMode: string;
  createdAt: Date;
}

export function useDonationNotifications() {
  const [notifications, setNotifications] = useState<DonationNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDonations() {
      if (typeof window === "undefined") return;
      
      try {
        setLoading(true);
        setError(null);
        
        const { donationService } = await import("@/services/donation.service");
        const donations = await donationService.getDonations();
        
        const recentDonations: DonationNotification[] = [];
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        
        donations.forEach((donation) => {
          const createdAt = donation.createdAt 
            ? new Date(donation.createdAt) 
            : new Date();
          
          if (createdAt.getTime() >= sevenDaysAgo) {
            recentDonations.push({
              id: donation.id,
              donorName: donation.donorName || "Anonymous",
              amount: donation.amount || 0,
              purpose: donation.purpose || "General Donation",
              paymentMode: donation.paymentMode || "unknown",
              createdAt,
            });
          }
        });
        
        setNotifications(recentDonations);
        setUnreadCount(recentDonations.length);
        setLoading(false);
      } catch (err: any) {
        console.log("Donation notifications unavailable:", err?.message);
        setError(null);
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
      }
    }

    fetchDonations();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchDonations, 60000);
    
    return () => clearInterval(interval);
  }, []);

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
