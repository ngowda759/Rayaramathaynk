"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";

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
      if (!db) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");
        
        const donationsRef = collection(db, "donations");
        const donationsQuery = query(
          donationsRef,
          orderBy("createdAt", "desc"),
          limit(20)
        );

        const snapshot = await getDocs(donationsQuery);
        
        const donations: DonationNotification[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Only show donations from last 7 days
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
          const daysDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysDiff <= 7) {
            donations.push({
              id: doc.id,
              donorName: data.donorName || "Anonymous",
              amount: data.amount || 0,
              purpose: data.purpose || "General Donation",
              paymentMode: data.paymentMode || "unknown",
              createdAt,
            });
          }
        });
        
        setNotifications(donations);
        setUnreadCount(donations.length);
        setLoading(false);
      } catch (err: any) {
        console.log("Donation notifications unavailable:", err?.message);
        setError(null); // Don't show error, just empty state
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
