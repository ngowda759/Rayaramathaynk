"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DonationPurpose, defaultDonationPurposes } from "@/types/donation";

const SETTINGS_DOC = "donationSettings";
const SETTINGS_COLLECTION = "settings";

export function useDonationPurposes() {
  const [purposes, setPurposes] = useState<DonationPurpose[]>(defaultDonationPurposes);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPurposes() {
      try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().donationPurposes) {
          const savedPurposes = docSnap.data().donationPurposes as DonationPurpose[];
          setPurposes(savedPurposes.filter((p: DonationPurpose) => p.isActive).sort((a, b) => a.order - b.order));
        }
      } catch (error) {
        console.error("Error loading donation purposes:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPurposes();
  }, []);

  return { purposes, loading };
}
