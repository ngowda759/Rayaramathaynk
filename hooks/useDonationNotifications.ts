"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, where, limit } from "firebase/firestore";
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

  useEffect(() => {
    // Listen to recent donations (last 50, pending status)
    const donationsRef = collection(db, "donations");
    const recentDonationsQuery = query(
      donationsRef,
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(recentDonationsQuery, (snapshot) => {
      const newDonations: DonationNotification[] = [];
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data() as DonationRecord;
          const isNew = Date.now() - new Date(data.createdAt).getTime() < 24 * 60 * 60 * 1000; // Last 24 hours
          
          newDonations.push({
            id: change.doc.id,
            donorName: data.donorName,
            amount: data.amount,
            purpose: data.purpose,
            paymentMode: data.paymentMode,
            createdAt: new Date(data.createdAt),
            isNew,
          });
        }
      });

      if (newDonations.length > 0) {
        setNotifications(prev => {
          const updated = [...newDonations, ...prev].slice(0, 20);
          return updated;
        });
        setUnreadCount(prev => prev + newDonations.length);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
