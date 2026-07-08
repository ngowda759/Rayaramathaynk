"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DonationRecord } from "@/types/donation";

interface DonationNotification {
  id: string;
  donorName: string;
  amount: number;
  purpose: string;
  paymentMode: string;
  createdAt: Date;
  isNew: boolean;
}

export function useDonationNotifications() {
  const [notifications, setNotifications] = useState<DonationNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    try {
      const donationsRef = collection(db, "donations");
      const recentDonationsQuery = query(
        donationsRef,
        orderBy("createdAt", "desc"),
        limit(50)
      );

      unsubscribe = onSnapshot(
        recentDonationsQuery,
        (snapshot) => {
          try {
            const newDonations: DonationNotification[] = [];
            
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const data = change.doc.data() as DonationRecord;
                const isNew = Date.now() - new Date(data.createdAt).getTime() < 24 * 60 * 60 * 1000;
                
                newDonations.push({
                  id: change.doc.id,
                  donorName: data.donorName || "Anonymous",
                  amount: data.amount || 0,
                  purpose: data.purpose || "General",
                  paymentMode: data.paymentMode || "unknown",
                  createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                  isNew,
                });
              }
            });

            // Initialize notifications from existing docs
            if (snapshot.docs.length > 0 && notifications.length === 0) {
              const existingDonations: DonationNotification[] = snapshot.docs
                .slice(0, 10)
                .map((doc) => {
                  const data = doc.data() as DonationRecord;
                  return {
                    id: doc.id,
                    donorName: data.donorName || "Anonymous",
                    amount: data.amount || 0,
                    purpose: data.purpose || "General",
                    paymentMode: data.paymentMode || "unknown",
                    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                    isNew: true,
                  };
                });
              setNotifications(existingDonations);
              setUnreadCount(existingDonations.length);
            }

            setLoading(false);
            setError(null);
          } catch (err) {
            console.error("Error processing donations:", err);
          }
        },
        (err) => {
          console.error("Donation snapshot error:", err);
          setError("Unable to load notifications");
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Donation notifications setup error:", err);
      setError("Unable to connect");
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
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
